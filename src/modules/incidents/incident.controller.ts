/**
 * UC-01: Record Wildlife Incident - Express Controller Layer
 * 
 * SOLID Principles Applied:
 * - Single Responsibility Principle (SRP): Handles HTTP transport, mapping request/response
 *   bodies and returning appropriate HTTP status codes. Business logic is strictly in IncidentService.
 * - Dependency Injection: Accepts `IncidentService` via constructor or factory.
 */

import { Request, Response } from 'express';
import { IncidentService } from './incident.service';
import { InMemoryIncidentRepository } from './incident.repository';
import { DomainValidationError } from './incident.strategy';
import { IncidentType } from './incident.model';

// Singleton instance for standard server lifecycle (can be overridden in testing)
const defaultRepository = new InMemoryIncidentRepository(true);
const defaultService = new IncidentService(defaultRepository);

export class IncidentController {
  private service: IncidentService;

  constructor(service: IncidentService = defaultService) {
    this.service = service;
  }

  /**
   * POST /api/incidents
   * Submits a single wildlife incident in real-time.
   */
  public createIncident = async (req: Request, res: Response): Promise<void> => {
    try {
      const incident = await this.service.recordIncident(req.body);
      res.status(201).json({
        success: true,
        message: 'Wildlife incident successfully recorded.',
        data: incident,
      });
    } catch (error: any) {
      if (error instanceof DomainValidationError || error.name === 'DomainValidationError') {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
        return;
      }
      console.error('[IncidentController] Unexpected error in createIncident:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to record incident.',
      });
    }
  };

  /**
   * POST /api/incidents/sync
   * Batch ingest endpoint for syncing records accumulated while offline.
   */
  public syncIncidents = async (req: Request, res: Response): Promise<void> => {
    try {
      const syncResult = await this.service.syncOfflineBatch(req.body);
      res.status(200).json({
        success: true,
        message: `Offline batch synchronization complete. Processed ${syncResult.processedCount} items (${syncResult.createdCount} created, ${syncResult.duplicatesCount} skipped).`,
        data: syncResult,
      });
    } catch (error: any) {
      if (error instanceof DomainValidationError || error.name === 'DomainValidationError') {
        res.status(400).json({
          success: false,
          error: 'Sync Batch Validation Error',
          message: error.message,
        });
        return;
      }
      console.error('[IncidentController] Unexpected error in syncIncidents:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to synchronize offline incidents.',
      });
    }
  };

  /**
   * GET /api/incidents
   * Retrieves all recorded incidents.
   */
  public getIncidents = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type, status } = req.query;
      const incidents = await this.service.getAllIncidents({
        type: type as IncidentType,
        status: status as string,
      });

      res.status(200).json({
        success: true,
        count: incidents.length,
        data: incidents,
      });
    } catch (error: any) {
      console.error('[IncidentController] Unexpected error in getIncidents:', error);
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message || 'Failed to retrieve incidents.',
      });
    }
  };

  /**
   * GET /api/incidents/:id
   * Retrieves a single incident by ID.
   */
  public getIncidentById = async (req: Request, res: Response): Promise<void> => {
    try {
      const incident = await this.service.getIncidentById(req.params.id);
      if (!incident) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: `Incident with ID '${req.params.id}' was not found.`,
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: incident,
      });
    } catch (error: any) {
      if (error instanceof DomainValidationError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  /**
   * PATCH /api/incidents/:id/dispatch
   * Dispatches field rangers to the reported incident coordinates.
   */
  public dispatchIncident = async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await this.service.dispatchRanger(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: `Field Ranger ${updated.assignedRangerName} dispatched to incident ${updated.id}.`,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof DomainValidationError) {
        res.status(400).json({
          success: false,
          error: 'Dispatch Error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };

  /**
   * PATCH /api/incidents/:id/resolve
   * Resolves the incident on-scene with action debrief.
   */
  public resolveIncident = async (req: Request, res: Response): Promise<void> => {
    try {
      const updated = await this.service.resolveIncident(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: `Incident ${updated.id} successfully resolved and logged.`,
        data: updated,
      });
    } catch (error: any) {
      if (error instanceof DomainValidationError) {
        res.status(400).json({
          success: false,
          error: 'Resolution Error',
          message: error.message,
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  };
}

export const incidentController = new IncidentController();

