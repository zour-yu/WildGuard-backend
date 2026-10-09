/**
 * Unit & Integration Test Suite: IncidentController & Routes
 */

import { Request, Response } from 'express';
import { IncidentController } from '../../src/modules/incidents/incident.controller';
import { IncidentService } from '../../src/modules/incidents/incident.service';
import { InMemoryIncidentRepository } from '../../src/modules/incidents/incident.repository';
import { IncidentValidationStrategyContext } from '../../src/modules/incidents/incident.strategy';

describe('IncidentController (UC-01)', () => {
  let repository: InMemoryIncidentRepository;
  let service: IncidentService;
  let controller: IncidentController;

  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    repository = new InMemoryIncidentRepository(true); // Seeds default
    service = new IncidentService(repository, new IncidentValidationStrategyContext());
    controller = new IncidentController(service);

    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  it('POST /api/incidents - returns 201 on valid submission', async () => {
    mockReq = {
      body: {
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'New snare located in East boundary',
        metadata: { riskLevel: 'CRITICAL', snareCount: 1 },
      },
    };

    await controller.createIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: 'Wildlife incident successfully recorded.',
        data: expect.objectContaining({
          type: 'SNARE',
        }),
      })
    );
  });

  it('POST /api/incidents - returns 400 on domain validation error', async () => {
    mockReq = {
      body: {
        type: 'CARCASS',
        coordinates: [6.834, 80.988],
        description: 'Carcass found without decomposition state',
        metadata: {},
      },
    };

    await controller.createIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: 'Validation Error',
      })
    );
  });

  it('POST /api/incidents/sync - returns 200 on batch sync', async () => {
    mockReq = {
      body: {
        incidents: [
          {
            id: 'OFF-BATCH-1',
            type: 'SNARE',
            coordinates: [6.834, 80.988],
            description: 'Offline snare 1',
            metadata: { riskLevel: 'LOW' },
          },
          {
            id: 'OFF-BATCH-2',
            type: 'ILLEGAL_CAMPSITE',
            coordinates: [6.82, 80.97],
            description: 'Offline camp 2',
            metadata: { campfireDetected: false },
          },
        ],
      },
    };

    await controller.syncIncidents(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          processedCount: 2,
          createdCount: 2,
        }),
      })
    );
  });

  it('POST /api/incidents/sync - returns 400 when sync payload is invalid', async () => {
    mockReq = {
      body: {
        incidents: 'not-an-array',
      },
    };

    await controller.syncIncidents(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('GET /api/incidents - returns 200 with list of incidents', async () => {
    mockReq = {
      query: {},
    };

    await controller.getIncidents(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        count: expect.any(Number),
        data: expect.any(Array),
      })
    );
  });

  it('GET /api/incidents/:id - returns 200 when incident is found', async () => {
    mockReq = {
      params: { id: 'INC-2026-001' },
    };

    await controller.getIncidentById(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'INC-2026-001' }),
      })
    );
  });

  it('GET /api/incidents/:id - returns 404 when incident does not exist', async () => {
    mockReq = {
      params: { id: 'NON_EXISTENT_ID' },
    };

    await controller.getIncidentById(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('GET /api/incidents/:id - returns 400 when ID is invalid', async () => {
    mockReq = {
      params: { id: '' },
    };

    await controller.getIncidentById(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('POST /api/incidents - handles unexpected 500 error gracefully', async () => {
    jest.spyOn(service, 'recordIncident').mockRejectedValueOnce(new Error('DB crash'));
    mockReq = {
      body: {
        type: 'SNARE',
        coordinates: [6.83, 80.98],
        description: 'Test snare',
        metadata: { riskLevel: 'LOW' },
      },
    };

    await controller.createIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('GET /api/incidents - handles unexpected 500 error gracefully', async () => {
    jest.spyOn(service, 'getAllIncidents').mockRejectedValueOnce(new Error('Query failed'));
    mockReq = { query: {} };

    await controller.getIncidents(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('PATCH /api/incidents/:id/dispatch - successfully dispatches a ranger', async () => {
    mockReq = {
      params: { id: 'INC-2026-001' },
      body: {
        rangerId: 'RNG-001',
        rangerName: 'Sgt. Tharaka Bandara',
        notes: 'Deploy immediately',
      },
    };

    await controller.dispatchIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          status: 'DISPATCHED',
          assignedRangerId: 'RNG-001',
        }),
      })
    );
  });

  it('PATCH /api/incidents/:id/dispatch - returns 400 when validation fails', async () => {
    mockReq = {
      params: { id: 'INC-2026-001' },
      body: { rangerId: '' }, // missing rangerId
    };

    await controller.dispatchIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('PATCH /api/incidents/:id/dispatch - handles 500 server error', async () => {
    jest.spyOn(service, 'dispatchRanger').mockRejectedValueOnce(new Error('Dispatch crash'));
    mockReq = {
      params: { id: 'INC-2026-001' },
      body: { rangerId: 'RNG-001' },
    };

    await controller.dispatchIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });

  it('PATCH /api/incidents/:id/resolve - returns 400 when resolutionNotes is missing', async () => {
    mockReq = {
      params: { id: 'INC-2026-001' },
      body: { resolutionNotes: '' },
    };

    await controller.resolveIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });

  it('PATCH /api/incidents/:id/resolve - handles 500 server error', async () => {
    jest.spyOn(service, 'resolveIncident').mockRejectedValueOnce(new Error('Resolve crash'));
    mockReq = {
      params: { id: 'INC-2026-001' },
      body: { resolutionNotes: 'Resolved' },
    };

    await controller.resolveIncident(mockReq as Request, mockRes as Response);

    expect(statusMock).toHaveBeenCalledWith(500);
  });
});
