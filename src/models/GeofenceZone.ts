import mongoose, { Document, Schema } from 'mongoose';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IGeofenceZone extends Document {
  zoneName: string;
  description?: string;
  riskLevel: RiskLevel;
  // Polygon coordinates: Array of [latitude, longitude] pairs defining vertices
  coordinates: [number, number][];
  bufferZoneKm: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeofenceZoneSchema = new Schema<IGeofenceZone>(
  {
    zoneName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
      required: true,
    },
    coordinates: {
      type: [[Number]],
      required: true,
      validate: {
        validator: function (val: [number, number][]) {
          return Array.isArray(val) && val.length >= 3;
        },
        message: 'A geofence polygon must have at least 3 vertices.',
      },
    },
    bufferZoneKm: {
      type: Number,
      default: 1.5,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export const GeofenceZone = mongoose.model<IGeofenceZone>(
  'GeofenceZone',
  GeofenceZoneSchema
);
