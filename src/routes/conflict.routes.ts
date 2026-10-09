import { Router } from 'express';
import { getConflicts, mockSms, submitAppReport, updateConflictStatus } from '../controllers/conflict.controller';
import { optionalFirebaseToken } from '../middleware/auth.middleware';
import { upload } from '../config/cloudinary.config';

const router = Router();

// Retrieve conflicts (verifies token if provided, falls through in dev/demo)
router.get('/', optionalFirebaseToken, getConflicts);

// Update status / acknowledge / dispatch conflict
router.patch('/:id/status', updateConflictStatus);

// Leave mock-sms unprotected (for simulators and Twilio webhooks)
router.post('/mock-sms', mockSms);

// App report from citizens (includes image upload)
router.post('/report', upload.single('image'), submitAppReport);

export default router;
