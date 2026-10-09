import { Request, Response } from 'express';
import User from '../models/User';

export const syncUser = async (req: Request, res: Response) => {
  try {
    const { firebaseId, email, name, role } = req.body;

    if (!firebaseId || !email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    let user = await User.findOne({ firebaseId });

    if (!user) {
      user = new User({
        firebaseId,
        email,
        name: name || 'Citizen User',
        role: role || 'Citizen'
      });
      await user.save();
    } else {
      // Update name if provided
      if (name) user.name = name;
      await user.save();
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.error('Error syncing user:', error);
    res.status(500).json({ message: 'Internal server error', error });
  }
};
