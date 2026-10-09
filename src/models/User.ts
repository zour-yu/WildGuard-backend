import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firebaseId: string;
  name: string;
  role: string;
  email: string;
}

const UserSchema: Schema = new Schema({
  firebaseId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  role: { type: String, required: true, enum: ['Liaison', 'Ranger', 'Park Manager', 'Citizen'] },
  email: { type: String, required: true, unique: true },
  address: { type: String },
  district: { type: String },
  province: { type: String },
});

export default mongoose.model<IUser>('User', UserSchema);
