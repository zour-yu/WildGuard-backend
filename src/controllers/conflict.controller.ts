import { Request, Response } from 'express';
import Conflict from '../models/Conflict';
import { getSocketServer } from '../sockets/alert.socket';
import cloudinary from '../config/cloudinary.config';

export const getConflicts = async (req: Request, res: Response) => {
  try {
    const conflicts = await Conflict.find().sort({ reportedAt: -1 });
    res.status(200).json(conflicts);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching conflicts', error });
  }
};

export const mockSms = async (req: Request, res: Response) => {
  try {
    const { body, from } = req.body;
    
    // Simulate parsing the Twilio incoming SMS
    // In a real Twilio webhook, the text is in req.body.Body and sender is in req.body.From
    const text = body || "Elephant spotted near the village perimeter";
    const sender = from || "+94771234567";

    const newConflict = new Conflict({
      source: 'SMS',
      priority: 'HIGH', // We'll assume all incoming SMS are HIGH priority for the mockup
      status: 'UNREAD',
      description: text,
      reporter: sender,
      location: 'Unknown (Needs verification)',
      latitude: 7.8, // Dummy coordinates for Sri Lanka
      longitude: 80.7,
      reportedAt: new Date()
    });

    await newConflict.save();

    // Broadcast the new conflict via Socket.io to all connected frontend clients
    const io = getSocketServer();
    if (io) {
      io.emit('conflict:new', newConflict);
    }

    res.status(201).json({ 
      success: true, 
      message: 'Mock SMS processed and broadcasted', 
      conflict: newConflict 
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing mock SMS', error });
  }
};

export const submitAppReport = async (req: Request, res: Response) => {
  try {
    const { category, reporter, location, description, name, phone } = req.body;
    let imageUrl = '';

    if (req.file) {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const uploadResponse = await cloudinary.uploader.upload(dataURI, {
        folder: 'wildguard_reports',
      });
      imageUrl = uploadResponse.secure_url;
    }

    const finalReporter = name && phone ? `${name} (${phone})` : (reporter || 'Citizen App User');
    const finalDescription = description ? `[${category || 'Alert'}] ${description}` : `MOBILE APP ALERT: ${category || 'Unknown'}`;

    const newConflict = new Conflict({
      source: 'App',
      priority: 'HIGH',
      status: 'UNREAD',
      description: finalDescription,
      reporter: finalReporter,
      location: location || 'Galwala Boundary',
      latitude: 6.8256,
      longitude: 80.9924,
      reportedAt: new Date(),
      imageUrl: imageUrl || undefined
    });

    await newConflict.save();

    const io = getSocketServer();
    if (io) {
      io.emit('conflict:new', newConflict);
    }

    res.status(201).json({ success: true, conflict: newConflict });
  } catch (error) {
    console.error('Error submitting app report:', error);
    res.status(500).json({ message: 'Error processing app report', error });
  }
};
