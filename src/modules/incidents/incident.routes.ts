/**
 * UC-01: Record Wildlife Incident - Express Router
 * 
 * SOLID Principles Applied:
 * - Single Responsibility Principle (SRP): Dedicated solely to defining HTTP routes
 *   and delegating execution to the IncidentController.
 */

import { Router } from 'express';
import { incidentController } from './incident.controller';

const router: Router = Router();

// Submit real-time single incident
router.post('/', incidentController.createIncident);

// Ingest batch sync from offline mobile queue (handles deduplication)
router.post('/sync', incidentController.syncIncidents);

// Fetch all recorded incidents with optional filters (?type=SNARE&status=RECORDED)
router.get('/', incidentController.getIncidents);

// Fetch incident detail by ID
router.get('/:id', incidentController.getIncidentById);

// Dispatch field rangers to the incident coordinates (supports both PATCH and POST)
router.patch('/:id/dispatch', incidentController.dispatchIncident);
router.post('/:id/dispatch', incidentController.dispatchIncident);

// Resolve incident on-scene (supports both PATCH and POST)
router.patch('/:id/resolve', incidentController.resolveIncident);
router.post('/:id/resolve', incidentController.resolveIncident);

export default router;
