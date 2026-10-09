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

export default router;
