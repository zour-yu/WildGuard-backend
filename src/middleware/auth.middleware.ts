import { Request, Response, NextFunction } from 'express';
import { authAdmin } from '../config/firebase.config';

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const verifyFirebaseToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid Authorization header' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    const decodedToken = await authAdmin.verifyIdToken(idToken);
    req.user = decodedToken;
    
    next();
  } catch (error) {
    console.error('Firebase Auth Error:', error);
    return res.status(401).json({ message: 'Unauthorized: Token verification failed' });
  }
};
