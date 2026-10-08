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
    const activeZones = await GeofenceZone.find({ isActive: true }).exec();

    for (const zone of activeZones) {
      const breached = this.isPointInPolygon([lat, lng], zone.coordinates);
      if (breached) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Retrieves all registered geofence zones.
   */
  public static async getAllZones(): Promise<IGeofenceZone[]> {
    return GeofenceZone.find().sort({ createdAt: -1 }).exec();
  }
}
