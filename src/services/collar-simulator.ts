import { CollarTelemetry, ICollarTelemetry } from '../models/CollarTelemetry';
import { GeofenceZone, IGeofenceZone } from '../models/GeofenceZone';
import { AlertDispatch, IAlertDispatch } from '../models/AlertDispatch';
import { GeofenceService } from './geofence.service';
import { emitAnimalBreach, emitTelemetryPing } from '../sockets/alert.socket';

// Mock GPS trajectory coordinates moving from deep jungle -> fence perimeter -> farmland buffer zone (breach) -> safe zone
export const SIMULATED_GPS_ROUTE: [number, number][] = [
  // Deep reserve safe zone
  [6.8150, 80.9600],
  [6.8200, 80.9640],
  // Approaching electrified boundary fence
  [6.8250, 80.9680],
  [6.8285, 80.9720],
  // GEOFENCE BREACH: Crossing into Perimeter Buffer Zone A (Farmland / Human Settlement)
  [6.8320, 80.9750],
  [6.8345, 80.9785],
  [6.8370, 80.9820],
  [6.8390, 80.9850],
  // Returning back into sanctuary perimeter
  [6.8420, 80.9680],
  [6.8250, 80.9630],
];

// Verified camera trap snapshots for automated image verification
const CAMERA_TRAP_SNAPSHOTS = [
  'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1581852017103-68ac6550407b?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=800&q=80',
];

export class CollarSimulator {
  private static timer: NodeJS.Timeout | null = null;
  private static currentIndex: number = 0;
  private static isRunning: boolean = false;
  private static intervalMs: number = 4000;

  public static readonly DEFAULT_ANIMAL = {
    collarId: 'COL-EL-904',
    animalId: 'ANM-00904',
    animalName: 'Raja (Alpha Tusker)',
    species: 'Asian Elephant (Elephas maximus)',
  };

  /**
   * Initializes default geofence zones in the database if none exist.
   */
  public static async initDefaultZones(): Promise<void> {
    try {
      const existingZoneCount = await GeofenceZone.countDocuments();
      if (existingZoneCount === 0) {
        console.log('[CollarSimulator] Seeding default Buffer Zones for testing...');
        await GeofenceZone.create([
          {
            zoneName: 'Perimeter Buffer Zone A - Medawachchiya Farmlands',
            description: 'Critical electric fence boundary adjoining village agricultural crops.',
            riskLevel: 'CRITICAL',
            // Polygon encompassing coordinates [6.830 - 6.840, 80.974 - 80.988]
            coordinates: [
              [6.8300, 80.9730],
              [6.8300, 80.9880],
              [6.8410, 80.9880],
              [6.8410, 80.9730],
            ],
            bufferZoneKm: 1.5,
            isActive: true,
          },
          {
            zoneName: 'Corridor Buffer Zone B - Railway Sanctuary Crossing',
            description: 'Railway reserve corridor with high-speed train collision risk.',
            riskLevel: 'HIGH',
            coordinates: [
              [6.8450, 80.9800],
              [6.8450, 80.9950],
              [6.8550, 80.9950],
              [6.8550, 80.9800],
            ],
            bufferZoneKm: 2.0,
            isActive: true,
          },
        ]);
        console.log('[CollarSimulator] Geofence zones successfully seeded.');
      }
    } catch (err) {
      console.error('[CollarSimulator] Error initializing default zones:', err);
    }
  }

  /**
   * Performs one cycle of collar telemetry emission and geofence evaluation.
   */
  public static async simulateStep(): Promise<{
    telemetry: ICollarTelemetry;
    breachAlert?: IAlertDispatch | null;
  }> {
    const coords = SIMULATED_GPS_ROUTE[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % SIMULATED_GPS_ROUTE.length;

    const [lat, lng] = coords;
    // Decrement battery slowly to simulate real-world battery discharge
    const simulatedBattery = Math.max(30, Math.floor(95 - this.currentIndex * 1.5));
    const simulatedSpeed = parseFloat((3.5 + Math.random() * 4).toFixed(1));
    const simulatedHeading = Math.floor(Math.random() * 360);

    // 1. Evaluate Geofence Breach via Ray-Casting spatial engine
    const breachedZone = await GeofenceService.checkGeofenceBreach(lat, lng);
    const isBreaching = !!breachedZone;

    // 2. Persist collar telemetry in MongoDB
    let telemetry: ICollarTelemetry;
    try {
      telemetry = await CollarTelemetry.create({
        collarId: this.DEFAULT_ANIMAL.collarId,
        animalName: this.DEFAULT_ANIMAL.animalName,
        species: this.DEFAULT_ANIMAL.species,
        location: [lat, lng],
        batteryLevel: simulatedBattery,
        speedKmh: simulatedSpeed,
        heading: simulatedHeading,
        isBreaching,
        breachZoneName: breachedZone ? breachedZone.zoneName : undefined,
        timestamp: new Date(),
      });
    } catch (err) {
      // In case MongoDB is offline or initial setup, build ephemeral object
      telemetry = new CollarTelemetry({
        collarId: this.DEFAULT_ANIMAL.collarId,
        animalName: this.DEFAULT_ANIMAL.animalName,
        species: this.DEFAULT_ANIMAL.species,
        location: [lat, lng],
        batteryLevel: simulatedBattery,
        speedKmh: simulatedSpeed,
        heading: simulatedHeading,
        isBreaching,
        breachZoneName: breachedZone ? breachedZone.zoneName : undefined,
        timestamp: new Date(),
      });
    }

    // 3. Emit real-time telemetry ping over Socket.io
    emitTelemetryPing({
      collarId: telemetry.collarId,
      animalName: telemetry.animalName,
      species: telemetry.species,
      location: telemetry.location,
      batteryLevel: telemetry.batteryLevel,
      speedKmh: telemetry.speedKmh,
      heading: telemetry.heading,
      timestamp: telemetry.timestamp.toISOString(),
      isBreaching,
      breachZoneName: breachedZone?.zoneName,
    });

    let breachAlert: IAlertDispatch | null = null;

    // 4. Trigger alert dispatch on breach
    if (isBreaching && breachedZone) {
      console.log(`[ALERT] GEOFENCE BREACH DETECTED for ${telemetry.animalName} at [${lat}, ${lng}]!`);

      // Prevent continuous duplicate alerts if an active alert already exists within the last 30 minutes
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
      const existingActiveAlert = await AlertDispatch.findOne({
        collarId: telemetry.collarId,
        status: { $in: ['ACTIVE', 'ACCEPTED'] },
        createdAt: { $gte: thirtyMinutesAgo },
      }).exec();

      if (existingActiveAlert) {
        // Update coordinates of the current active dispatch
        existingActiveAlert.location = [lat, lng];
        await existingActiveAlert.save();
        breachAlert = existingActiveAlert;
      } else {
        // Pick camera trap image verification snapshot
        const randomImg =
          CAMERA_TRAP_SNAPSHOTS[
            Math.floor(Math.random() * CAMERA_TRAP_SNAPSHOTS.length)
          ];

        breachAlert = await AlertDispatch.create({
          animalId: this.DEFAULT_ANIMAL.animalId,
          animalName: this.DEFAULT_ANIMAL.animalName,
          species: this.DEFAULT_ANIMAL.species,
          collarId: this.DEFAULT_ANIMAL.collarId,
          geofenceId: breachedZone._id,
          zoneName: breachedZone.zoneName,
          riskLevel: breachedZone.riskLevel,
          location: [lat, lng],
          status: 'ACTIVE',
          cameraTrapImageUrl: randomImg,
          notes: `Automated IoT Geofence Alert: Elephant entered buffer zone with high agricultural conflict probability.`,
        });

        // 5. Broadcast animal:breach event via Socket.io
        emitAnimalBreach({
          alertId: breachAlert._id.toString(),
          animalId: breachAlert.animalId,
          animalName: breachAlert.animalName,
          species: breachAlert.species,
          collarId: breachAlert.collarId,
          location: breachAlert.location,
          zoneName: breachAlert.zoneName,
          riskLevel: breachAlert.riskLevel,
          cameraTrapImageUrl: breachAlert.cameraTrapImageUrl,
          timestamp: breachAlert.createdAt.toISOString(),
          status: breachAlert.status,
          distanceToSettlementKm: 0.45,
        });
      }
    }

    return { telemetry, breachAlert };
  }

  /**
   * Starts periodic timer emitting mock GPS coordinates.
   */
  public static start(intervalMs = 4000): void {
    if (this.isRunning) {
      console.log('[CollarSimulator] Simulator already running.');
      return;
    }

    this.intervalMs = intervalMs;
    this.isRunning = true;
    console.log(`[CollarSimulator] Started background collar simulator (${this.intervalMs}ms interval)`);

    this.timer = setInterval(async () => {
      try {
        await this.simulateStep();
      } catch (err) {
        console.error('[CollarSimulator] Error in simulation tick:', err);
      }
    }, this.intervalMs);
  }

  /**
   * Stops the background telemetry simulator.
   */
  public static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[CollarSimulator] Stopped background collar simulator.');
  }

  public static getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    currentIndex: number;
    totalWaypoints: number;
  } {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      currentIndex: this.currentIndex,
      totalWaypoints: SIMULATED_GPS_ROUTE.length,
    };
  }

  public static resetIndex(): void {
    this.currentIndex = 0;
  }
}
