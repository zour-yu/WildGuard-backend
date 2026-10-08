import { Request, Response } from 'express';
import Conflict from '../models/Conflict';
import { getSocketServer } from '../sockets/alert.socket';

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
