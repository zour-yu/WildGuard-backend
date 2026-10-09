import mongoose from 'mongoose';
import { AlertDispatch, IAlertDispatch, AlertStatus } from '../models/AlertDispatch';
import { emitDispatchUpdate } from '../sockets/alert.socket';
import User from '../models/User';

export interface RangerInfo {
  rangerId: string;
  name: string;
  callsign: string;
  status: 'AVAILABLE' | 'ON_PATROL' | 'BUSY';
  location: [number, number];
  batteryLevel: number;
}

export interface RecommendedRanger extends RangerInfo {
  distanceKm: number;
  etaMinutes: number;
  isNearest: boolean;
}

// Simulated field rangers deployed across park sectors
export const MOCK_RANGERS: RangerInfo[] = [
  {
    rangerId: 'RNG-002',
    name: 'Officer Nimal Silva',
    callsign: 'Rhino-3',
    status: 'AVAILABLE',
    location: [6.831, 80.976], // very close to Medawachchiya buffer (~0.4 km)
    batteryLevel: 94,
  },
  {
    rangerId: 'RNG-001',
    name: 'Sgt. Tharaka Bandara',
    callsign: 'Kestrel-1',
    status: 'AVAILABLE',
    location: [6.832, 80.985],
    batteryLevel: 88,
  },
  {
    rangerId: 'RNG-004',
    name: 'Ranger Dilshan Jayasinghe',
    callsign: 'Falcon-4',
    status: 'AVAILABLE',
    location: [6.822, 80.981],
    batteryLevel: 92,
  },
  {
    rangerId: 'RNG-003',
    name: 'Officer Chaminda Perera',
    callsign: 'Eagle-2',
    status: 'ON_PATROL',
    location: [6.845, 80.992],
    batteryLevel: 76,
  },
];

// Fallback in-memory alerts store if MongoDB is offline / initializing
const inMemoryDispatches: any[] = [
  {
    _id: 'DSP-HIST-001',
    animalId: 'ANM-00812',
    animalName: 'Kalu (Lone Bull)',
    species: 'Asian Elephant (Elephas maximus)',
    collarId: 'COL-EL-812',
    zoneName: 'Perimeter Buffer Zone A - Medawachchiya Farmlands',
    riskLevel: 'CRITICAL',
    location: [6.834, 80.979],
    assignedRangerId: 'RNG-002',
    assignedRangerName: 'Officer Nimal Silva',
    status: 'RESOLVED',
    cameraTrapImageUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=800&q=80',
    notes: 'Acoustic siren and thunder-flares deployed. Alpha bull safely redirected 1.2km away from paddy fields. Electric fence line inspected: fully operational.',
    dispatchedAt: new Date(Date.now() - 3600000 * 3),
    acceptedAt: new Date(Date.now() - 3600000 * 3 + 180000),
    resolvedAt: new Date(Date.now() - 3600000 * 3 + 1200000),
    incidentHandoffId: 'INC-2026-0914',
    createdAt: new Date(Date.now() - 3600000 * 3),
    updatedAt: new Date(Date.now() - 3600000 * 3 + 1200000),
  },
  {
    _id: 'DSP-HIST-002',
    animalId: 'ANM-00755',
    animalName: 'Bhanu (Matriarch)',
    species: 'Asian Elephant (Elephas maximus)',
    collarId: 'COL-EL-755',
    zoneName: 'Corridor Buffer Zone B - Railway Sanctuary Crossing',
    riskLevel: 'HIGH',
    location: [6.848, 80.985],
    assignedRangerId: 'RNG-003',
    assignedRangerName: 'Officer Chaminda Perera',
    status: 'RESOLVED',
    cameraTrapImageUrl: 'https://images.unsplash.com/photo-1581852017103-68ac6550407b?auto=format&fit=crop&w=800&q=80',
    notes: 'Herd of 5 elephants guided away from active railway track prior to night express train. Solar floodlights activated.',
    dispatchedAt: new Date(Date.now() - 3600000 * 8),
    acceptedAt: new Date(Date.now() - 3600000 * 8 + 120000),
    resolvedAt: new Date(Date.now() - 3600000 * 8 + 1500000),
    incidentHandoffId: 'INC-2026-0912',
    createdAt: new Date(Date.now() - 3600000 * 8),
    updatedAt: new Date(Date.now() - 3600000 * 8 + 1500000),
  },
  {
    _id: 'DSP-ACT-001',
    animalId: 'ANM-00904',
    animalName: 'Raja (Alpha Tusker)',
    species: 'Asian Elephant (Elephas maximus)',
    collarId: 'COL-EL-904',
    zoneName: 'Perimeter Buffer Zone A - Medawachchiya Farmlands',
    riskLevel: 'CRITICAL',
    location: [6.832, 80.975],
    status: 'ACTIVE',
    cameraTrapImageUrl: 'https://images.unsplash.com/photo-1564760055775-d63b17a55c44?auto=format&fit=crop&w=800&q=80',
    notes: 'Elephant detected approaching village boundary fence. High crop conflict probability.',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export class DispatchService {
  /**
   * Helper Haversine distance in kilometers
   */
  public static calculateDistanceKm(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;
    const R = 6371;
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
  }

  /**
   * Recommends field rangers sorted by distance from the breach coordinate.
   */
  public static async recommendRangers(
    breachLocation: [number, number]
  ): Promise<RecommendedRanger[]> {
    const dbRangers = await User.find({ role: 'Ranger' }).exec();

    // Map DB rangers to RangerInfo, mixing in some mock state (location, battery)
    // since the User model doesn't store active telemetry.
    const activeRangers: RangerInfo[] = dbRangers.map((r, i) => {
      // Create a deterministic offset from breach location for realistic display
      const latOffset = (i % 2 === 0 ? 1 : -1) * 0.01 * (i + 1);
      const lngOffset = (i % 3 === 0 ? 1 : -1) * 0.01 * (i + 1);
      
      return {
        rangerId: r._id.toString(),
        name: r.name,
        callsign: `Unit-${r.name.split(' ')[0]}-${i+1}`,
        status: i % 4 === 0 ? 'ON_PATROL' : 'AVAILABLE',
        location: [breachLocation[0] + latOffset, breachLocation[1] + lngOffset],
        batteryLevel: 100 - (i * 7),
      };
    });

    // Fallback to MOCK_RANGERS if no real rangers found
    const rangersToUse = activeRangers.length > 0 ? activeRangers : MOCK_RANGERS;

    const rangersWithDistance = rangersToUse.map((ranger) => {
      const distanceKm = this.calculateDistanceKm(breachLocation, ranger.location);
      // Rough field speed estimate: 30 km/h in reserve terrain
      const etaMinutes = Math.max(2, Math.ceil((distanceKm / 30) * 60));
      return {
        ...ranger,
        distanceKm,
        etaMinutes,
        isNearest: false,
      };
    });

    // Sort ascending by distance
    rangersWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    if (rangersWithDistance.length > 0) {
      rangersWithDistance[0].isNearest = true;
    }

    return rangersWithDistance;
  }

  /**
   * Retrieves all active/unresolved breach alerts.
   */
  public static async getActiveAlerts(): Promise<any[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbAlerts = await AlertDispatch.find({
          status: { $in: ['ACTIVE', 'ACCEPTED', 'REJECTED'] },
        })
          .sort({ createdAt: -1 })
          .maxTimeMS(2500)
          .exec();

        if (dbAlerts && dbAlerts.length > 0) {
          return dbAlerts;
        }
      } catch (err) {
        console.warn('[DispatchService] Fallback to in-memory active alerts');
      }
    }

    return inMemoryDispatches.filter((d) =>
      ['ACTIVE', 'ACCEPTED', 'REJECTED'].includes(d.status)
    );
  }

  /**
   * Retrieves full dispatch log / history (including RESOLVED dispatches).
   */
  public static async getDispatchHistory(): Promise<any[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbAlerts = await AlertDispatch.find()
          .sort({ updatedAt: -1, createdAt: -1 })
          .limit(100)
          .maxTimeMS(2500)
          .exec();

        if (dbAlerts && dbAlerts.length > 0) {
          // Merge with in-memory samples if DB has few
          const dbIds = new Set(dbAlerts.map((a) => a._id.toString()));
          const combined = [
            ...dbAlerts,
            ...inMemoryDispatches.filter((m) => !dbIds.has(m._id.toString())),
          ];
          return combined.sort(
            (a, b) =>
              new Date(b.updatedAt || b.createdAt).getTime() -
              new Date(a.updatedAt || a.createdAt).getTime()
          );
        }
      } catch (err) {
        console.warn('[DispatchService] Fallback to in-memory dispatch history');
      }
    }

    return [...inMemoryDispatches].sort(
      (a, b) =>
        new Date(b.updatedAt || b.createdAt).getTime() -
        new Date(a.updatedAt || a.createdAt).getTime()
    );
  }

  /**
   * Dispatches a field ranger to an active animal breach alert.
   */
  public static async assignRanger(
    alertId: string,
    rangerId: string,
    rangerName?: string,
    notes?: string,
    alertData?: any
  ): Promise<any> {
    const matchedRanger = MOCK_RANGERS.find((r) => r.rangerId === rangerId);
    const assignedName = rangerName || matchedRanger?.name || `Ranger ${rangerId}`;
    const now = new Date();

    let updatedAlert: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const alert = await AlertDispatch.findById(alertId).maxTimeMS(2500);
        if (alert) {
          alert.assignedRangerId = rangerId;
          alert.assignedRangerName = assignedName;
          alert.dispatchedAt = now;
          alert.status = 'ACTIVE';
          if (notes) alert.notes = notes;
          updatedAlert = await alert.save();
        } else if (alertData) {
          // If not found in DB but we have alertData (e.g. Citizen Conflict), save it to DB!
          const newAlert = new AlertDispatch({
            ...alertData,
            _id: alertId,
            assignedRangerId: rangerId,
            assignedRangerName: assignedName,
            dispatchedAt: now,
            status: 'ACTIVE',
            notes: notes || '',
            createdAt: alertData.createdAt || now,
            updatedAt: now,
          });
          updatedAlert = await newAlert.save();
        }
      } catch (e) {
        console.warn('[DispatchService] Could not save assignRanger to DB:', e);
      }
    }

    // In-memory update/sync (fallback)
    const memAlert = inMemoryDispatches.find((d) => d._id.toString() === alertId);
    if (memAlert) {
      memAlert.assignedRangerId = rangerId;
      memAlert.assignedRangerName = assignedName;
      memAlert.dispatchedAt = now;
      memAlert.status = 'ACTIVE';
      if (notes) memAlert.notes = notes;
      memAlert.updatedAt = now;
      if (!memAlert.createdAt && alertData?.createdAt) memAlert.createdAt = alertData.createdAt;
      if (!updatedAlert) updatedAlert = memAlert;
    } else if (!updatedAlert) {
      updatedAlert = {
        ...(alertData || {}),
        _id: alertId,
        assignedRangerId: rangerId,
        assignedRangerName: assignedName,
        dispatchedAt: now,
        status: 'ACTIVE',
        notes: notes || '',
        updatedAt: now,
        createdAt: alertData?.createdAt || now,
      };
      inMemoryDispatches.push(updatedAlert);
    }

    // Broadcast dispatch assignment via Socket.io
    emitDispatchUpdate({
      dispatchId: (updatedAlert._id || alertId).toString(),
      status: updatedAlert.status,
      assignedRangerId: updatedAlert.assignedRangerId,
      assignedRangerName: updatedAlert.assignedRangerName,
      notes: updatedAlert.notes,
      updatedAt: now.toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Handles ranger acceptance or rejection from the Ranger Field Terminal.
   */
  public static async respondToDispatch(
    dispatchId: string,
    rangerId: string,
    action: 'ACCEPT' | 'REJECT',
    reasonOrNotes?: string
  ): Promise<any> {
    const now = new Date();
    let updatedAlert: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const alert = await AlertDispatch.findById(dispatchId).maxTimeMS(2500);
        if (alert) {
          if (action === 'ACCEPT') {
            alert.status = 'ACCEPTED';
            alert.acceptedAt = now;
            if (reasonOrNotes) {
              alert.notes = alert.notes
                ? `${alert.notes} | Ranger: ${reasonOrNotes}`
                : `Ranger: ${reasonOrNotes}`;
            }
          } else {
            alert.status = 'REJECTED';
            alert.rejectedAt = now;
            alert.rejectionReason = reasonOrNotes || 'Ranger unable to respond - out of sector';
          }
          updatedAlert = await alert.save();
        }
      } catch (e) {
        console.warn('[DispatchService] Could not save respondToDispatch to DB:', e);
      }
    }

    // In-memory update/sync
    const memAlert = inMemoryDispatches.find((d) => d._id.toString() === dispatchId);
    if (memAlert) {
      if (action === 'ACCEPT') {
        memAlert.status = 'ACCEPTED';
        memAlert.acceptedAt = now;
        if (reasonOrNotes) {
          memAlert.notes = memAlert.notes
            ? `${memAlert.notes} | Ranger: ${reasonOrNotes}`
            : `Ranger: ${reasonOrNotes}`;
        }
      } else {
        memAlert.status = 'REJECTED';
        memAlert.rejectedAt = now;
        memAlert.rejectionReason = reasonOrNotes || 'Ranger unable to respond';
      }
      memAlert.updatedAt = now;
      if (!updatedAlert) updatedAlert = memAlert;
    } else if (!updatedAlert) {
      updatedAlert = {
        _id: dispatchId,
        status: action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED',
        acceptedAt: action === 'ACCEPT' ? now : undefined,
        rejectedAt: action === 'REJECT' ? now : undefined,
        rejectionReason: action === 'REJECT' ? reasonOrNotes : undefined,
        updatedAt: now,
      };
      inMemoryDispatches.push(updatedAlert);
    }

    // Broadcast status change to operations dashboard
    emitDispatchUpdate({
      dispatchId: (updatedAlert._id || dispatchId).toString(),
      status: updatedAlert.status,
      assignedRangerId: updatedAlert.assignedRangerId,
      assignedRangerName: updatedAlert.assignedRangerName,
      rejectionReason: updatedAlert.rejectionReason,
      notes: updatedAlert.notes,
      updatedAt: now.toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Resolves an alert on-scene and stores in dispatch log as history.
   */
  public static async resolveDispatch(
    dispatchId: string,
    resolutionNotes: string,
    incidentHandoffId?: string
  ): Promise<any> {
    const now = new Date();
    const handoffId = incidentHandoffId || `INC-${Date.now().toString().slice(-6)}`;
    let updatedAlert: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const alert = await AlertDispatch.findById(dispatchId).maxTimeMS(2500);
        if (alert) {
          alert.status = 'RESOLVED';
          alert.resolvedAt = now;
          alert.notes = alert.notes
            ? `${alert.notes} | Resolution: ${resolutionNotes}`
            : `Resolution: ${resolutionNotes}`;
          alert.incidentHandoffId = handoffId;
          updatedAlert = await alert.save();
        }
      } catch (e) {
        console.warn('[DispatchService] Could not save resolveDispatch to DB:', e);
      }
    }

    // In-memory update/sync
    const memAlert = inMemoryDispatches.find((d) => d._id.toString() === dispatchId);
    if (memAlert) {
      memAlert.status = 'RESOLVED';
      memAlert.resolvedAt = now;
      memAlert.notes = memAlert.notes
        ? `${memAlert.notes} | Resolution: ${resolutionNotes}`
        : `Resolution: ${resolutionNotes}`;
      memAlert.incidentHandoffId = handoffId;
      memAlert.updatedAt = now;
      if (!updatedAlert) updatedAlert = memAlert;
    } else if (!updatedAlert) {
      updatedAlert = {
        _id: dispatchId,
        status: 'RESOLVED',
        resolvedAt: now,
        notes: `Resolution: ${resolutionNotes}`,
        incidentHandoffId: handoffId,
        updatedAt: now,
      };
      inMemoryDispatches.push(updatedAlert);
    }

    emitDispatchUpdate({
      dispatchId: (updatedAlert._id || dispatchId).toString(),
      status: 'RESOLVED',
      notes: updatedAlert.notes,
      updatedAt: now.toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Returns simulated ranger personnel.
   */
  public static getAvailableRangers(): RangerInfo[] {
    return MOCK_RANGERS;
  }
}
