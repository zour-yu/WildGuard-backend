import { Router } from 'express';
import { syncUser, getMe } from '../controllers/auth.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';

const router = Router();

// Protect with verifyFirebaseToken so only authenticated Firebase users can sync
router.post('/sync', verifyFirebaseToken, syncUser);

// Get current user profile
router.get('/me', verifyFirebaseToken, getMe);

export default router;
