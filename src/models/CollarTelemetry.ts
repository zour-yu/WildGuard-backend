import mongoose, { Document, Schema } from 'mongoose';

export interface ICollarTelemetry extends Document {
  collarId: string;
  animalName: string;
  species: string;
  location: [number, number]; // [latitude, longitude]
  batteryLevel: number; // 0 - 100 percentage
  speedKmh?: number;
  heading?: number; // 0 - 360 degrees
  timestamp: Date;
  isBreaching?: boolean;
  breachZoneName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CollarTelemetrySchema = new Schema<ICollarTelemetry>(
  {
    collarId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    animalName: {
      type: String,
      required: true,
      trim: true,
    },
    species: {
      type: String,
      required: true,
      default: 'Asian Elephant (Elephas maximus)',
      trim: true,
    },
    location: {
      type: [Number], // [latitude, longitude]
      required: true,
      validate: {
        validator: function (val: number[]) {
          return val.length === 2;
        },
        message: 'Location must be a [latitude, longitude] tuple',
      },
    },
    batteryLevel: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 100,
    },
    speedKmh: {
      type: Number,
      default: 0,
    },
    heading: {
      type: Number,
      default: 0,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    isBreaching: {
      type: Boolean,
      default: false,
    },
    breachZoneName: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const CollarTelemetry = mongoose.model<ICollarTelemetry>(
  'CollarTelemetry',
  CollarTelemetrySchema
);
