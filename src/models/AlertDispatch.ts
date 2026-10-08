import mongoose, { Document, Schema } from 'mongoose';

export type AlertStatus = 'ACTIVE' | 'ACCEPTED' | 'REJECTED' | 'RESOLVED';

export interface IAlertDispatch extends Document {
  animalId: string;
  animalName: string;
  species: string;
  collarId: string;
  geofenceId?: mongoose.Types.ObjectId | string;
  zoneName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  location: [number, number]; // [lat, lng] at breach detection
  assignedRangerId?: string;
  assignedRangerName?: string;
  status: AlertStatus;
  cameraTrapImageUrl: string;
  notes?: string;
  rejectionReason?: string;
  dispatchedAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  resolvedAt?: Date;
  incidentHandoffId?: string; // Handoff to UC-01 Record Wildlife Incident
  createdAt: Date;
  updatedAt: Date;
}

const AlertDispatchSchema = new Schema<IAlertDispatch>(
  {
    animalId: {
      type: String,
      required: true,
      index: true,
    },
    animalName: {
      type: String,
      required: true,
      trim: true,
    },
    species: {
      type: String,
      default: 'Asian Elephant (Elephas maximus)',
    },
    collarId: {
      type: String,
      required: true,
    },
    geofenceId: {
      type: Schema.Types.ObjectId,
      ref: 'GeofenceZone',
    },
    zoneName: {
      type: String,
      required: true,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'CRITICAL',
    },
    location: {
      type: [Number],
      required: true,
      validate: {
        validator: function (val: number[]) {
          return val.length === 2;
        },
        message: 'Location must be [latitude, longitude]',
      },
    },
    assignedRangerId: {
      type: String,
      trim: true,
    },
    assignedRangerName: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ACCEPTED', 'REJECTED', 'RESOLVED'],
      default: 'ACTIVE',
      index: true,
    },
    cameraTrapImageUrl: {
      type: String,
      required: true,
      default: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=800&q=80',
    },
    notes: {
      type: String,
      default: '',
    },
    rejectionReason: {
      type: String,
    },
    dispatchedAt: {
      type: Date,
    },
    acceptedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
    resolvedAt: {
      type: Date,
    },
    incidentHandoffId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const AlertDispatch = mongoose.model<IAlertDispatch>(
  'AlertDispatch',
  AlertDispatchSchema
);
