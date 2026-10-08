import { Router } from 'express';
import { getConflicts, mockSms } from '../controllers/conflict.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';

const router = Router();

// Protect the GET route with Firebase Auth
router.get('/', verifyFirebaseToken, getConflicts);

// Leave mock-sms unprotected (since Twilio won't have a Firebase token in production)
router.post('/mock-sms', mockSms);

export default router;
