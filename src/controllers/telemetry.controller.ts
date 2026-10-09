import { Request, Response } from 'express';
import { CollarTelemetry } from '../models/CollarTelemetry';
import { GeofenceZone } from '../models/GeofenceZone';
import { DispatchService } from '../services/dispatch.service';
import { CollarSimulator } from '../services/collar-simulator';
import { GeofenceService } from '../services/geofence.service';

export class TelemetryController {
  /**
   * GET /api/telemetry/collars
   * Returns the latest telemetry coordinates for all tracked collars.
   */
  public static async getLatestCollarTelemetry(req: Request, res: Response): Promise<void> {
    try {
      // Find latest telemetry entry for each unique collarId
      const latestTelemetry = await CollarTelemetry.aggregate([
        { $sort: { timestamp: -1 } },
        {
          $group: {
            _id: '$collarId',
            latestDoc: { $first: '$$ROOT' },
          },
        },
        { $replaceRoot: { newRoot: '$latestDoc' } },
      ]);

      // If no telemetry entries exist yet in DB, return current simulator default
      if (latestTelemetry.length === 0) {
        res.status(200).json({
          success: true,
          data: [
            {
              collarId: CollarSimulator.DEFAULT_ANIMAL.collarId,
              animalName: CollarSimulator.DEFAULT_ANIMAL.animalName,
              species: CollarSimulator.DEFAULT_ANIMAL.species,
              location: [6.832, 80.975],
              batteryLevel: 88,
              speedKmh: 4.8,
              heading: 142,
              timestamp: new Date().toISOString(),
              isBreaching: true,
              breachZoneName: 'Perimeter Buffer Zone A - Medawachchiya Farmlands',
            },
          ],
        });
        return;
      }

      res.status(200).json({
        success: true,
        count: latestTelemetry.length,
        data: latestTelemetry,
      });
    } catch (error: any) {
      console.error('[TelemetryController] getLatestCollarTelemetry error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve collar telemetry',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/alerts/active
   * Retrieves all currently active and unresolved breach alerts.
   */
  public static async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const activeAlerts = await DispatchService.getActiveAlerts();
      res.status(200).json({
        success: true,
        count: activeAlerts.length,
        data: activeAlerts,
      });
    } catch (error: any) {
      console.error('[TelemetryController] getActiveAlerts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active alerts',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/alerts/:id/dispatch
   * Manager dispatches a ranger to respond to an animal breach alert.
   */
  public static async dispatchRanger(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rangerId, rangerName, notes } = req.body;

      if (!rangerId) {
        res.status(400).json({
          success: false,
          message: 'rangerId is required for dispatch',
        });
        return;
      }

      const updatedDispatch = await DispatchService.assignRanger(
        id,
        rangerId,
        rangerName,
        notes
      );

      res.status(200).json({
        success: true,
        message: `Ranger ${updatedDispatch.assignedRangerName} successfully dispatched`,
        data: updatedDispatch,
      });
    } catch (error: any) {
      console.error('[TelemetryController] dispatchRanger error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to dispatch ranger',
        error: error.message,
      });
    }
  }

  /**
   * PATCH /api/dispatches/:id/respond
   * Ranger accepts or rejects the emergency alert dispatch.
   */
  public static async respondToDispatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { rangerId, action, reason, notes } = req.body;

      if (!action || !['ACCEPT', 'REJECT'].includes(action)) {
        res.status(400).json({
          success: false,
          message: 'Action must be either ACCEPT or REJECT',
        });
        return;
      }

      const updatedDispatch = await DispatchService.respondToDispatch(
        id,
        rangerId || 'RNG-CURRENT',
        action,
        action === 'REJECT' ? reason : notes
      );

      res.status(200).json({
        success: true,
        message: `Mission ${action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'} successfully`,
        data: updatedDispatch,
      });
    } catch (error: any) {
      console.error('[TelemetryController] respondToDispatch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process ranger response',
        error: error.message,
      });
    }
  }

  /**
   * PATCH /api/dispatches/:id/resolve
   * Ranger resolves the alert on-scene, marking it RESOLVED and preparing UC-01 handoff.
   */
  public static async resolveDispatch(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { notes, incidentHandoffId } = req.body;

      const updatedDispatch = await DispatchService.resolveDispatch(
        id,
        notes || 'Incident stabilized on-scene.',
        incidentHandoffId
      );

      res.status(200).json({
        success: true,
        message: 'Dispatch successfully marked as RESOLVED and handed off to incident log.',
        data: updatedDispatch,
      });
    } catch (error: any) {
      console.error('[TelemetryController] resolveDispatch error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to resolve dispatch',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/geofences
   * Returns all active geofence danger zones.
   */
  public static async getGeofenceZones(req: Request, res: Response): Promise<void> {
    try {
      const zones = await GeofenceService.getAllZones();
      res.status(200).json({
        success: true,
        data: zones,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch geofence zones',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/dispatches/history
   * Retrieves all logged dispatches and incident history (including RESOLVED and REJECTED).
   */
  public static async getDispatchHistory(req: Request, res: Response): Promise<void> {
    try {
      const history = await DispatchService.getDispatchHistory();
      res.status(200).json({
        success: true,
        count: history.length,
        data: history,
      });
    } catch (error: any) {
      console.error('[TelemetryController] getDispatchHistory error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve dispatch history',
        error: error.message,
      });
    }
  }

  /**
   * GET /api/rangers/recommend?lat=6.832&lng=80.975
   * Calculates distance from incident location to all available rangers and highlights nearest.
   */
  public static async getRecommendedRangers(req: Request, res: Response): Promise<void> {
    try {
      const lat = parseFloat(req.query.lat as string) || 6.832;
      const lng = parseFloat(req.query.lng as string) || 80.975;
      const recommended = DispatchService.recommendRangers([lat, lng]);

      res.status(200).json({
        success: true,
        incidentLocation: [lat, lng],
        count: recommended.length,
        data: recommended,
      });
    } catch (error: any) {
      console.error('[TelemetryController] getRecommendedRangers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate ranger recommendations',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/simulator/step
   * Manually steps the collar telemetry simulator for rapid testing.
   */
  public static async triggerSimulatorStep(req: Request, res: Response): Promise<void> {
    try {
      const result = await CollarSimulator.simulateStep();
      res.status(200).json({
        success: true,
        message: 'Simulated step processed successfully',
        data: result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to process simulator step',
        error: error.message,
      });
    }
  }

  /**
   * POST /api/simulator/toggle
   * Starts or stops the background GPS collar simulator.
   */
  public static async toggleSimulator(req: Request, res: Response): Promise<void> {
    try {
      const status = CollarSimulator.getStatus();
      if (status.isRunning) {
        CollarSimulator.stop();
      } else {
        CollarSimulator.start(4000);
      }
      res.status(200).json({
        success: true,
        data: CollarSimulator.getStatus(),
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to toggle simulator',
        error: error.message,
      });
    }
  }
}
