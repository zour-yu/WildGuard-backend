/**
 * Unit Test Suite: TelemetryController & Dispatch Service (UC-04: Respond to Animal Risk Alert)
 * Member 3 (Your Part): Respond to Animal Risk Alerts & Field Dispatch Management
 */

import { Request, Response } from 'express';
import { TelemetryController } from '../../src/controllers/telemetry.controller';
import { DispatchService } from '../../src/services/dispatch.service';
import { CollarTelemetry } from '../../src/models/CollarTelemetry';
import { GeofenceService } from '../../src/services/geofence.service';
import { CollarSimulator } from '../../src/services/collar-simulator';

// Mock Socket.io alerts module to isolate unit testing
jest.mock('../../src/sockets/alert.socket', () => ({
  emitDispatchUpdate: jest.fn(),
  emitAnimalBreach: jest.fn(),
  emitTelemetryPing: jest.fn(),
  getSocketServer: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
}));

// Mock CollarTelemetry model for unit testing
jest.mock('../../src/models/CollarTelemetry', () => ({
  CollarTelemetry: {
    aggregate: jest.fn(),
  },
}));

describe('TelemetryController (UC-04: Respond to Animal Risk Alert)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Test Case 1: Positive - Dispatch Ranger to Active Animal Breach Alert
  // =========================================================================
  describe('Test Case 1: dispatchRanger (Positive - Dispatch Assignment)', () => {
    it('should successfully dispatch a ranger to an animal breach alert and return 200', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          rangerId: 'RNG-002',
          rangerName: 'Officer Nimal Silva',
          notes: 'Emergency dispatch: elephant herd breaching boundary near farmland',
          alertData: {
            animalName: 'Kalu (Lone Bull)',
            species: 'Asian Elephant',
            zoneName: 'Perimeter Buffer Zone A',
            riskLevel: 'CRITICAL',
          },
        },
      };

      await TelemetryController.dispatchRanger(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('Officer Nimal Silva successfully dispatched'),
          data: expect.objectContaining({
            assignedRangerId: 'RNG-002',
            assignedRangerName: 'Officer Nimal Silva',
            status: 'ACTIVE',
          }),
        })
      );
    });
  });

  // =========================================================================
  // Test Case 2: Negative - Dispatch Validation (Missing rangerId)
  // =========================================================================
  describe('Test Case 2: dispatchRanger (Negative - Validation Error)', () => {
    it('should return 400 Bad Request when rangerId is missing from dispatch request', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          notes: 'Dispatch without assigning any ranger',
        },
      };

      await TelemetryController.dispatchRanger(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'rangerId is required for dispatch',
        })
      );
    });

    it('should return 500 when dispatchRanger encounters an unexpected service failure', async () => {
      jest.spyOn(DispatchService, 'assignRanger').mockRejectedValue(new Error('Database error on dispatch'));
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: { rangerId: 'RNG-002' },
      };

      await TelemetryController.dispatchRanger(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to dispatch ranger',
        })
      );
    });
  });

  // =========================================================================
  // Test Case 3: State Transitions (Ranger Acceptance/Rejection & Resolution)
  // =========================================================================
  describe('Test Case 3: respondToDispatch & resolveDispatch (State Transitions & Handoff)', () => {
    it('should allow ranger to ACCEPT dispatch mission and transition status to ACCEPTED', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          rangerId: 'RNG-002',
          action: 'ACCEPT',
          notes: 'En route with deterrent gear and vehicle Unit-3',
        },
      };

      await TelemetryController.respondToDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('ACCEPTED'),
          data: expect.objectContaining({
            status: 'ACCEPTED',
          }),
        })
      );
    });

    it('should allow ranger to REJECT dispatch mission with reason', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          rangerId: 'RNG-002',
          action: 'REJECT',
          reason: 'Patrol vehicle breakdown on bridge route',
        },
      };

      await TelemetryController.respondToDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('REJECTED'),
          data: expect.objectContaining({
            status: 'REJECTED',
          }),
        })
      );
    });

    it('should return 400 when an invalid ranger response action is provided', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          rangerId: 'RNG-002',
          action: 'PENDING', // Invalid action: must be ACCEPT or REJECT
        },
      };

      await TelemetryController.respondToDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Action must be either ACCEPT or REJECT',
        })
      );
    });

    it('should return 500 when respondToDispatch encounters a service error', async () => {
      jest.spyOn(DispatchService, 'respondToDispatch').mockRejectedValue(new Error('State sync failed'));
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: { rangerId: 'RNG-002', action: 'ACCEPT' },
      };

      await TelemetryController.respondToDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should successfully resolve the dispatch on-scene with incident handoff reference', async () => {
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: {
          notes: 'Elephant herd redirected 2km back into core reserve. Electric fence checked.',
          incidentHandoffId: 'INC-2026-HANDOFF-88',
        },
      };

      await TelemetryController.resolveDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: expect.stringContaining('RESOLVED'),
          data: expect.objectContaining({
            status: 'RESOLVED',
            incidentHandoffId: 'INC-2026-HANDOFF-88',
          }),
        })
      );
    });

    it('should return 500 when resolveDispatch encounters a service failure', async () => {
      jest.spyOn(DispatchService, 'resolveDispatch').mockRejectedValue(new Error('Handoff write failed'));
      mockReq = {
        params: { id: 'DSP-TEST-ALERT-001' },
        body: { notes: 'Incident completed' },
      };

      await TelemetryController.resolveDispatch(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  // Test Case 4: getLatestCollarTelemetry (Telemetry Reporting)
  // =========================================================================
  describe('Test Case 4: getLatestCollarTelemetry (Telemetry Reporting)', () => {
    it('should return 200 and list of aggregated collar telemetry reports', async () => {
      const mockTelemetryData = [
        {
          collarId: 'COL-TEST-01',
          animalName: 'Kalu (Lone Bull)',
          species: 'Asian Elephant',
          location: [6.832, 80.975],
          batteryLevel: 94,
          speedKmh: 4.8,
          heading: 142,
          timestamp: new Date().toISOString(),
          isBreaching: true,
          breachZoneName: 'Perimeter Buffer Zone A',
        },
      ];

      (CollarTelemetry.aggregate as jest.Mock).mockResolvedValue(mockTelemetryData);
      mockReq = {};

      await TelemetryController.getLatestCollarTelemetry(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          count: 1,
          data: mockTelemetryData,
        })
      );
    });

    it('should fallback to default simulator telemetry data when database has 0 records', async () => {
      (CollarTelemetry.aggregate as jest.Mock).mockResolvedValue([]);
      mockReq = {};

      await TelemetryController.getLatestCollarTelemetry(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.arrayContaining([
            expect.objectContaining({
              collarId: expect.any(String),
              animalName: expect.any(String),
              location: expect.any(Array),
            }),
          ]),
        })
      );
    });

    it('should return 500 when telemetry aggregation throws an unexpected error', async () => {
      (CollarTelemetry.aggregate as jest.Mock).mockRejectedValue(new Error('Database connection timeout'));
      mockReq = {};

      await TelemetryController.getLatestCollarTelemetry(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Failed to retrieve collar telemetry',
        })
      );
    });
  });

  // =========================================================================
  // Test Case 5: getActiveAlerts (Breach Risk Alert Retrieval)
  // =========================================================================
  describe('Test Case 5: getActiveAlerts (Animal Breach Monitoring)', () => {
    it('should return 200 with all active and unresolved animal breach alerts', async () => {
      mockReq = {};

      await TelemetryController.getActiveAlerts(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should return 500 when getActiveAlerts encounters a query failure', async () => {
      jest.spyOn(DispatchService, 'getActiveAlerts').mockRejectedValue(new Error('Alert query error'));
      mockReq = {};

      await TelemetryController.getActiveAlerts(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  // Test Case 6: getRecommendedRangers (Proximity Calculation)
  // =========================================================================
  describe('Test Case 6: getRecommendedRangers (Ranger Distance & ETA)', () => {
    it('should return 200 with ranked ranger recommendations based on incident coordinates', async () => {
      const mockRecommendations = [
        {
          rangerId: 'RNG-002',
          name: 'Officer Nimal Silva',
          callsign: 'Rhino-3',
          status: 'AVAILABLE' as const,
          location: [6.831, 80.976] as [number, number],
          batteryLevel: 94,
          distanceKm: 0.15,
          etaMinutes: 2,
          isNearest: true,
        },
      ];

      jest.spyOn(DispatchService, 'recommendRangers').mockResolvedValue(mockRecommendations);

      mockReq = {
        query: {
          lat: '6.832',
          lng: '80.975',
        },
      };

      await TelemetryController.getRecommendedRangers(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          incidentLocation: [6.832, 80.975],
          data: mockRecommendations,
        })
      );
    });

    it('should use default coordinates when query parameters are omitted', async () => {
      jest.spyOn(DispatchService, 'recommendRangers').mockResolvedValue([]);
      mockReq = { query: {} };

      await TelemetryController.getRecommendedRangers(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          incidentLocation: [6.832, 80.975],
        })
      );
    });

    it('should return 500 when recommendRangers throws an error', async () => {
      jest.spyOn(DispatchService, 'recommendRangers').mockRejectedValue(new Error('Distance calculation error'));
      mockReq = { query: {} };

      await TelemetryController.getRecommendedRangers(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  // Test Case 7: getGeofenceZones (Geofence Buffer Retrieval)
  // =========================================================================
  describe('Test Case 7: getGeofenceZones (Protected Geofence Zones)', () => {
    it('should return 200 and list of active geofence danger zones', async () => {
      const mockZones = [
        {
          zoneId: 'ZONE-A',
          name: 'Perimeter Buffer Zone A',
          riskLevel: 'HIGH',
        },
      ];

      jest.spyOn(GeofenceService, 'getAllZones').mockResolvedValue(mockZones as any);

      mockReq = {};

      await TelemetryController.getGeofenceZones(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockZones,
        })
      );
    });

    it('should return 500 when getGeofenceZones encounters an error', async () => {
      jest.spyOn(GeofenceService, 'getAllZones').mockRejectedValue(new Error('Geofence DB error'));
      mockReq = {};

      await TelemetryController.getGeofenceZones(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  // Test Case 8: getDispatchHistory (Log History)
  // =========================================================================
  describe('Test Case 8: getDispatchHistory (Logged Dispatches)', () => {
    it('should return 200 and list of historical dispatches', async () => {
      mockReq = {};

      await TelemetryController.getDispatchHistory(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should return 500 when getDispatchHistory encounters an error', async () => {
      jest.spyOn(DispatchService, 'getDispatchHistory').mockRejectedValue(new Error('History query error'));
      mockReq = {};

      await TelemetryController.getDispatchHistory(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });

  // =========================================================================
  // Test Case 9: Simulator Control (Manual Step & Toggle)
  // =========================================================================
  describe('Test Case 9: Simulator Control (Manual Step & Toggle)', () => {
    it('should process a manual simulator telemetry step and return 200', async () => {
      jest.spyOn(CollarSimulator, 'simulateStep').mockResolvedValue({
        animalName: 'Kalu',
        location: [6.832, 80.975],
      } as any);

      mockReq = {};

      await TelemetryController.triggerSimulatorStep(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Simulated step processed successfully',
        })
      );
    });

    it('should return 500 when triggerSimulatorStep encounters an error', async () => {
      jest.spyOn(CollarSimulator, 'simulateStep').mockRejectedValue(new Error('Simulator step error'));
      mockReq = {};

      await TelemetryController.triggerSimulatorStep(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });

    it('should toggle simulator state and return 200', async () => {
      jest.spyOn(CollarSimulator, 'getStatus').mockReturnValue({
        isRunning: false,
        intervalMs: 4000,
      } as any);
      jest.spyOn(CollarSimulator, 'start').mockImplementation(() => {});

      mockReq = {};

      await TelemetryController.toggleSimulator(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should stop simulator if it is currently running', async () => {
      jest.spyOn(CollarSimulator, 'getStatus').mockReturnValue({
        isRunning: true,
        intervalMs: 4000,
      } as any);
      jest.spyOn(CollarSimulator, 'stop').mockImplementation(() => {});

      mockReq = {};

      await TelemetryController.toggleSimulator(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should return 500 when toggleSimulator encounters an error', async () => {
      jest.spyOn(CollarSimulator, 'getStatus').mockImplementation(() => {
        throw new Error('Toggle error');
      });
      mockReq = {};

      await TelemetryController.toggleSimulator(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
    });
  });
});
