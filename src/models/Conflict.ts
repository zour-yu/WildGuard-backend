import mongoose, { Schema, Document } from 'mongoose';

export interface IConflict extends Document {
  source: string;
  priority: string;
  status: string;
  description: string;
  reporter: string;
  location: string;
  latitude: number;
  longitude: number;
  reportedAt: Date;
  resolvedAt?: Date;
  handlerId?: mongoose.Types.ObjectId;
  notes?: string;
}

const ConflictSchema: Schema = new Schema({
  source: { type: String, required: true, enum: ['SMS', 'App'] },
  priority: { type: String, required: true, enum: ['HIGH', 'MEDIUM', 'LOW'] },
  status: { type: String, required: true, enum: ['UNREAD', 'ACKNOWLEDGED', 'DISPATCHED', 'RESOLVED'], default: 'UNREAD' },
  description: { type: String, required: true },
  reporter: { type: String, required: true },
  location: { type: String, required: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  reportedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date },
  handlerId: { type: Schema.Types.ObjectId, ref: 'User' },
  notes: { type: String }
});

export default mongoose.model<IConflict>('Conflict', ConflictSchema);
