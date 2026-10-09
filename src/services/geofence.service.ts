import { GeofenceZone, IGeofenceZone } from '../models/GeofenceZone';

/**
 * Spatial calculation engine for Geofence calculations
 * Implements Ray-Casting (Jordan Curve Theorem) point-in-polygon algorithm.
 */
export class GeofenceService {
  /**
   * Ray-Casting algorithm to check if a coordinate [lat, lng] is inside a polygon.
   *
   * @param point [latitude, longitude]
   * @param polygon Array of [latitude, longitude] vertices defining the closed boundary
   * @returns boolean true if the point falls inside the polygon boundary
   */
  public static isPointInPolygon(
    point: [number, number],
    polygon: [number, number][]
  ): boolean {
    if (!polygon || polygon.length < 3) {
      return false;
    }

    const [pLat, pLng] = point;
    let isInside = false;

    // Loop through each edge of the polygon (from i to j)
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [latI, lngI] = polygon[i];
      const [latJ, lngJ] = polygon[j];

      // Check whether the edge crosses the horizontal latitude scanline of pLat
      const intersectsLatitude =
        (latI > pLat) !== (latJ > pLat);

      if (intersectsLatitude) {
        // Calculate the longitude coordinate where the edge crosses pLat
        const intersectLng =
          lngI + ((pLat - latI) * (lngJ - lngI)) / (latJ - latI);

        // Cast ray towards positive longitude (+E)
        if (pLng < intersectLng) {
          isInside = !isInside;
        }
      }
    }

    return isInside;
  }

  /**
   * Calculate great-circle distance between two GPS coordinates in kilometers (Haversine formula).
   */
  public static calculateHaversineDistanceKm(
    point1: [number, number],
    point2: [number, number]
  ): number {
    const [lat1, lon1] = point1;
    const [lat2, lon2] = point2;

    const EARTH_RADIUS_KM = 6371;
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((EARTH_RADIUS_KM * c).toFixed(2));
  }

  /**
   * Evaluates if a given coordinate intersects any active Geofence danger/buffer zone in MongoDB.
   * Returns the breached zone document if an intrusion is detected, otherwise null.
   */
  public static async checkGeofenceBreach(
    lat: number,
    lng: number
  ): Promise<IGeofenceZone | null> {
    try {
      let activeZones: IGeofenceZone[] = [];

      // Check if MongoDB is connected (readyState === 1)
      const mongoose = await import('mongoose');
      if (mongoose.default.connection.readyState === 1) {
        activeZones = await GeofenceZone.find({ isActive: true })
          .maxTimeMS(2000)
          .exec();
      } else {
        // Fallback to built-in buffer zones if MongoDB is connecting or offline
        activeZones = this.getDefaultFallbackZones();
      }

      for (const zone of activeZones) {
        const breached = this.isPointInPolygon([lat, lng], zone.coordinates);
        if (breached) {
          return zone;
        }
      }
    } catch (err) {
      console.warn('[GeofenceService] DB query failed, using fallback zones:', err);
      const fallbackZones = this.getDefaultFallbackZones();
      for (const zone of fallbackZones) {
        if (this.isPointInPolygon([lat, lng], zone.coordinates)) {
          return zone;
        }
      }
    }

    return null;
  }

  /**
   * Default fallback zones in case database is temporarily unreachable.
   */
  public static getDefaultFallbackZones(): any[] {
    return [
      {
        _id: 'zone-default-01',
        zoneName: 'Perimeter Buffer Zone A - Medawachchiya Farmlands',
        description: 'Critical electric fence boundary adjoining village agricultural crops.',
        riskLevel: 'CRITICAL',
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
        _id: 'zone-default-02',
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
    ];
  }

  /**
   * Retrieves all registered geofence zones.
   */
  public static async getAllZones(): Promise<IGeofenceZone[]> {
    try {
      const mongoose = await import('mongoose');
      if (mongoose.default.connection.readyState === 1) {
        return await GeofenceZone.find().sort({ createdAt: -1 }).maxTimeMS(2000).exec();
      }
    } catch (e) {
      // ignore
    }
    return this.getDefaultFallbackZones() as unknown as IGeofenceZone[];
  }
}
