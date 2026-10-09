import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Conflict from '../models/Conflict';
import { getSocketServer } from '../sockets/alert.socket';
import cloudinary from '../config/cloudinary.config';

// In-Memory Fallback Store (Galwala Sanctuary buffer zone coordinates)
let inMemoryConflicts: any[] = [
  {
    _id: 'conf-mock-001',
    source: 'SMS',
    priority: 'HIGH',
    status: 'UNREAD',
    description: 'Elephant herd spotted breaking perimeter fence near Galwala Farmland 8A.',
    reporter: '+94771234567',
    location: 'Sector 4: Farmland 8A Buffer',
    latitude: 6.8224,
    longitude: 80.9742,
    reportedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    _id: 'conf-mock-002',
    source: 'App',
    priority: 'HIGH',
    status: 'UNREAD',
    description: 'Crop damage reported in paddy fields along western canal border.',
    reporter: 'W. Fernando (+94719876543)',
    location: 'Sector 5: Western Settlement Buffer',
    latitude: 6.8378,
    longitude: 80.9658,
    reportedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    imageUrl: 'https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=600&q=80',
  },
  {
    _id: 'conf-mock-003',
    source: 'SMS',
    priority: 'MEDIUM',
    status: 'ACKNOWLEDGED',
    description: 'Lone bull elephant crossing highway near Handapanagala Reservoir.',
    reporter: '+94765551234',
    location: 'Sector 2: Reservoir Basin',
    latitude: 6.8512,
    longitude: 80.9984,
    reportedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    _id: 'conf-mock-004',
    source: 'SMS',
    priority: 'HIGH',
    status: 'UNREAD',
    description: 'Villagers reporting aggressive elephant near southern community water well.',
    reporter: '+94709887766',
    location: 'Sector 4: Farmland 8A Buffer',
    latitude: 6.8182,
    longitude: 80.9815,
    reportedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
];

export const getConflicts = async (_req: Request, res: Response) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const conflicts = await Conflict.find().sort({ reportedAt: -1 });
      if (conflicts && conflicts.length > 0) {
        return res.status(200).json(conflicts);
      }
    }
    return res.status(200).json(inMemoryConflicts);
  } catch (error) {
    console.warn('MongoDB query failed, falling back to in-memory conflicts:', error);
    return res.status(200).json(inMemoryConflicts);
  }
};

const GALWALA_HOTSPOTS = [
  { location: 'Sector 4: Farmland 8A Buffer', lat: 6.822, lng: 80.974 },
  { location: 'Sector 5: Western Settlement Buffer', lat: 6.838, lng: 80.966 },
  { location: 'Sector 2: Reservoir Basin', lat: 6.852, lng: 80.999 },
  { location: 'Sector 6: Eastern Transit Corridor', lat: 6.829, lng: 81.004 },
  { location: 'Sector 1: Northern Ridge', lat: 6.855, lng: 80.975 },
];

const determinePriority = (text: string): 'HIGH' | 'MEDIUM' | 'LOW' => {
  const lower = text.toLowerCase();
  if (lower.includes('injury') || lower.includes('danger') || lower.includes('attack') || lower.includes('charging') || lower.includes('sos') || lower.includes('aggressive')) {
    return 'HIGH';
  }
  if (lower.includes('sighting') || lower.includes('spotted') || lower.includes('crossing') || lower.includes('near')) {
    return 'MEDIUM';
  }
  return 'LOW'; // crop damage, fences, tracks, and others
};

export const mockSms = async (req: Request, res: Response) => {
  try {
    const { body, from } = req.body;
    const text = body || 'Elephant spotted near the village perimeter';
    const sender = from || '+9477' + Math.floor(1000000 + Math.random() * 9000000);

    const hotspot = GALWALA_HOTSPOTS[Math.floor(Math.random() * GALWALA_HOTSPOTS.length)];
    const lat = hotspot.lat + (Math.random() - 0.5) * 0.008;
    const lng = hotspot.lng + (Math.random() - 0.5) * 0.008;

    let newConflictRecord: any;
    const priority = determinePriority(text);

    if (mongoose.connection.readyState === 1) {
      const newConflict = new Conflict({
        source: 'SMS',
        priority: priority,
        status: 'UNREAD',
        description: text,
        reporter: sender,
        location: hotspot.location,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lng.toFixed(4)),
        reportedAt: new Date(),
      });
      newConflictRecord = await newConflict.save();
    } else {
      newConflictRecord = {
        _id: 'conf-sim-' + Date.now(),
        source: 'SMS',
        priority: priority,
        status: 'UNREAD',
        description: text,
        reporter: sender,
        location: hotspot.location,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lng.toFixed(4)),
        reportedAt: new Date().toISOString(),
      };
      inMemoryConflicts = [newConflictRecord, ...inMemoryConflicts];
    }

    // Broadcast the new conflict via Socket.io to all connected frontend clients
    const io = getSocketServer();
    if (io) {
      io.emit('conflict:new', newConflictRecord);
    }

    res.status(201).json({
      success: true,
      message: 'Mock SMS processed and broadcasted',
      conflict: newConflictRecord,
    });
  } catch (error) {
    console.error('Error processing mock SMS:', error);
    res.status(500).json({ message: 'Error processing mock SMS', error });
  }
};

export const submitAppReport = async (req: Request, res: Response) => {
  try {
    const { category, reporter, location, description, name, phone } = req.body;
    let imageUrl = '';

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'wildguard_reports',
      });
      imageUrl = uploadResponse.secure_url;
    }

    const finalReporter = name && phone ? `${name} (${phone})` : reporter || 'Citizen App User';
    const finalDescription = description
      ? `[${category || 'Alert'}] ${description}`
      : `MOBILE APP ALERT: ${category || 'Unknown'}`;

    let hotspot = GALWALA_HOTSPOTS.find(h => h.location === location);
    if (!hotspot) {
      hotspot = GALWALA_HOTSPOTS[Math.floor(Math.random() * GALWALA_HOTSPOTS.length)];
    }
    const lat = hotspot.lat + (Math.random() - 0.5) * 0.008;
    const lng = hotspot.lng + (Math.random() - 0.5) * 0.008;

    let newConflictRecord: any;
    const priority = determinePriority(finalDescription);

    if (mongoose.connection.readyState === 1) {
      const newConflict = new Conflict({
        source: 'App',
        priority: priority,
        status: 'UNREAD',
        description: finalDescription,
        reporter: finalReporter,
        location: location || hotspot.location,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lng.toFixed(4)),
        reportedAt: new Date(),
        imageUrl: imageUrl || undefined,
      });
      newConflictRecord = await newConflict.save();
    } else {
      newConflictRecord = {
        _id: 'conf-app-' + Date.now(),
        source: 'App',
        priority: priority,
        status: 'UNREAD',
        description: finalDescription,
        reporter: finalReporter,
        location: location || hotspot.location,
        latitude: parseFloat(lat.toFixed(4)),
        longitude: parseFloat(lng.toFixed(4)),
        reportedAt: new Date().toISOString(),
        imageUrl: imageUrl || undefined,
      };
      inMemoryConflicts = [newConflictRecord, ...inMemoryConflicts];
    }

    const io = getSocketServer();
    if (io) {
      io.emit('conflict:new', newConflictRecord);
    }

    res.status(201).json({ success: true, conflict: newConflictRecord });
  } catch (error) {
    console.error('Error submitting app report:', error);
    res.status(500).json({ message: 'Error processing app report', error });
  }
};

export const updateConflictStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    let updatedConflict: any = null;

    if (mongoose.connection.readyState === 1) {
      updatedConflict = await Conflict.findByIdAndUpdate(
        id,
        {
          ...(status ? { status } : {}),
          ...(notes ? { notes } : {}),
          ...(status === 'RESOLVED' ? { resolvedAt: new Date() } : {}),
        },
        { new: true }
      );
    }

    if (!updatedConflict) {
      const idx = inMemoryConflicts.findIndex((c) => c._id === id);
      if (idx >= 0) {
        inMemoryConflicts[idx] = {
          ...inMemoryConflicts[idx],
          ...(status ? { status } : {}),
          ...(notes ? { notes } : {}),
          ...(status === 'RESOLVED' ? { resolvedAt: new Date().toISOString() } : {}),
        };
        updatedConflict = inMemoryConflicts[idx];
      }
    }

    if (!updatedConflict) {
      return res.status(404).json({ message: 'Conflict not found' });
    }

    const io = getSocketServer();
    if (io) {
      io.emit('conflict:updated', updatedConflict);
    }

    res.status(200).json({ success: true, conflict: updatedConflict });
  } catch (error) {
    console.error('Error updating conflict status:', error);
    res.status(500).json({ message: 'Error updating conflict status', error });
  }
};
