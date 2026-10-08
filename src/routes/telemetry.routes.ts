import { Router } from 'express';
import { TelemetryController } from '../controllers/telemetry.controller';

const router = Router();

// Telemetry & Collar Tracking
router.get('/telemetry/collars', TelemetryController.getLatestCollarTelemetry);

// Breach Alerts & Dispatch Flow (UC-04)
router.get('/alerts/active', TelemetryController.getActiveAlerts);
router.post('/alerts/:id/dispatch', TelemetryController.dispatchRanger);
router.patch('/dispatches/:id/respond', TelemetryController.respondToDispatch);
router.patch('/dispatches/:id/resolve', TelemetryController.resolveDispatch);

// Geofence & Ranger Data
router.get('/geofences', TelemetryController.getGeofenceZones);
router.get('/rangers', TelemetryController.getAvailableRangers);

// Simulator Testing Controls
router.post('/simulator/step', TelemetryController.triggerSimulatorStep);
router.post('/simulator/toggle', TelemetryController.toggleSimulator);

export default router;
