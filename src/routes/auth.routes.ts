import { Router } from 'express';
import { syncUser } from '../controllers/auth.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';

const router = Router();

// Protect with verifyFirebaseToken so only authenticated Firebase users can sync
router.post('/sync', verifyFirebaseToken, syncUser);

export default router;
