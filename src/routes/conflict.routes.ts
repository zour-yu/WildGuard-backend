import { Router } from 'express';
import { getConflicts, mockSms, submitAppReport } from '../controllers/conflict.controller';
import { verifyFirebaseToken } from '../middleware/auth.middleware';
import { upload } from '../config/cloudinary.config';

const router = Router();

// Protect the GET route with Firebase Auth
router.get('/', verifyFirebaseToken, getConflicts);

// Leave mock-sms unprotected (since Twilio won't have a Firebase token in production)
router.post('/mock-sms', mockSms);

// App report from citizens (includes image upload)
router.post('/report', upload.single('image'), submitAppReport);

export default router;
