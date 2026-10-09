/**
 * Unit Test Suite: IncidentService & Strategy Pattern (UC-01)
 * 
 * Coverage Target: >= 80% coverage on business logic & validation strategies.
 * Mocks network & database layers via repository abstraction (DIP).
 */

import { IncidentService } from '../../src/modules/incidents/incident.service';
import { IIncidentRepository, InMemoryIncidentRepository } from '../../src/modules/incidents/incident.repository';
import {
  IncidentValidationStrategyContext,
  DomainValidationError,
  SnareValidationStrategy,
  CarcassValidationStrategy,
  IllegalCampsiteValidationStrategy,
} from '../../src/modules/incidents/incident.strategy';
import {
  CreateIncidentDTO,
  SyncIncidentsDTO,
  Incident,
} from '../../src/modules/incidents/incident.model';

describe('IncidentService (UC-01: Record Wildlife Incident)', () => {
  let mockRepository: jest.Mocked<IIncidentRepository>;
  let validationContext: IncidentValidationStrategyContext;
  let service: IncidentService;

  beforeEach(() => {
    // Mock repository functions (DIP)
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      createBatch: jest.fn(),
      count: jest.fn(),
      clear: jest.fn(),
    };

    validationContext = new IncidentValidationStrategyContext();
    service = new IncidentService(mockRepository, validationContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // 1. Positive: Single Incident Submission
  // ==========================================
  describe('Positive: Single Incident Submission', () => {
    it('should successfully validate and save a valid SNARE incident', async () => {
      const validSnareDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'Wire snare attached to tree near watering hole',
        photoUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...',
        metadata: {
          riskLevel: 'HIGH',
          snareCount: 2,
          wireType: 'STEEL_CABLE',
        },
        reporterId: 'RNG-001',
        reporterName: 'Sgt. Tharaka Bandara',
      };

      // Mock repository response
      mockRepository.create.mockImplementation(async (incident: Incident) => incident);

      const result = await service.recordIncident(validSnareDto);

      expect(result).toBeDefined();
      expect(result.type).toBe('SNARE');
      expect(result.coordinates).toEqual([6.834, 80.988]);
      expect((result.metadata as any).riskLevel).toBe('HIGH');
      expect(result.status).toBe('RECORDED');
      expect(mockRepository.create).toHaveBeenCalledTimes(1);
    });

    it('should successfully validate and save a valid CARCASS incident', async () => {
      const validCarcassDto: CreateIncidentDTO = {
        type: 'CARCASS',
        coordinates: [6.842, 80.975],
        description: 'Wild boar carcass discovered with gunshot marks',
        metadata: {
          decompositionState: 'FRESH',
          species: 'Wild Boar (Sus scrofa)',
          causeOfDeath: 'POACHING',
        },
      };

      mockRepository.create.mockImplementation(async (incident: Incident) => incident);

      const result = await service.recordIncident(validCarcassDto);

      expect(result).toBeDefined();
      expect(result.type).toBe('CARCASS');
      expect((result.metadata as any).decompositionState).toBe('FRESH');
      expect(mockRepository.create).toHaveBeenCalled();
    });

    it('should successfully validate and save a valid ILLEGAL_CAMPSITE incident', async () => {
      const campsiteDto: CreateIncidentDTO = {
        type: 'ILLEGAL_CAMPSITE',
        coordinates: [6.819, 80.962],
        description: 'Smoldering campfire with discarded battery casings',
        metadata: {
          campfireDetected: true,
          estimatedPeople: 3,
        },
      };

      mockRepository.create.mockImplementation(async (incident: Incident) => incident);

      const result = await service.recordIncident(campsiteDto);

      expect(result).toBeDefined();
      expect(result.type).toBe('ILLEGAL_CAMPSITE');
      expect((result.metadata as any).campfireDetected).toBe(true);
      expect(mockRepository.create).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. Positive: Batch Offline Synchronization
  // ==========================================
  describe('Positive: Batch Offline Synchronization', () => {
    it('should successfully process multiple offline records and skip duplicate IDs', async () => {
      const batchDto: SyncIncidentsDTO = {
        incidents: [
          {
            id: 'CLIENT-OFFLINE-UUID-001',
            type: 'SNARE',
            coordinates: [6.834, 80.988],
            description: 'Snare line in sector 4',
            metadata: { riskLevel: 'MEDIUM' },
          },
          {
            id: 'CLIENT-OFFLINE-UUID-002',
            type: 'CARCASS',
            coordinates: [6.842, 80.975],
            description: 'Deer skeleton in dry riverbed',
            metadata: { decompositionState: 'SKELETAL' },
          },
          {
            id: 'CLIENT-OFFLINE-UUID-001', // Duplicate client ID
            type: 'SNARE',
            coordinates: [6.834, 80.988],
            description: 'Snare line in sector 4',
            metadata: { riskLevel: 'MEDIUM' },
          },
        ],
      };

      // Mock repository batch output with deduplication
      mockRepository.createBatch.mockResolvedValue({
        created: [
          {
            id: 'CLIENT-OFFLINE-UUID-001',
            type: 'SNARE',
            coordinates: [6.834, 80.988],
            description: 'Snare line in sector 4',
            metadata: { riskLevel: 'MEDIUM' },
            reporterId: 'RNG-OFFLINE',
            reporterName: 'Field Ranger (Offline)',
            status: 'RECORDED',
            timestamp: new Date(),
            syncedFromOffline: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'CLIENT-OFFLINE-UUID-002',
            type: 'CARCASS',
            coordinates: [6.842, 80.975],
            description: 'Deer skeleton in dry riverbed',
            metadata: { decompositionState: 'SKELETAL' },
            reporterId: 'RNG-OFFLINE',
            reporterName: 'Field Ranger (Offline)',
            status: 'RECORDED',
            timestamp: new Date(),
            syncedFromOffline: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        skipped: ['CLIENT-OFFLINE-UUID-001'],
      });

      const response = await service.syncOfflineBatch(batchDto);

      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(3);
      expect(response.createdCount).toBe(2);
      expect(response.duplicatesCount).toBe(1);
      expect(response.skippedDuplicates).toContain('CLIENT-OFFLINE-UUID-001');
      expect(mockRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it('should return zero processed count when empty array is supplied', async () => {
      const emptyBatch: SyncIncidentsDTO = { incidents: [] };
      const response = await service.syncOfflineBatch(emptyBatch);

      expect(response.success).toBe(true);
      expect(response.processedCount).toBe(0);
      expect(response.createdCount).toBe(0);
      expect(mockRepository.createBatch).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3. Negative: Coordinate & Base Validation
  // ==========================================
  describe('Negative: Coordinate & Base Validation', () => {
    it('should throw DomainValidationError if coordinates are completely missing', async () => {
      const invalidDto: any = {
        type: 'SNARE',
        description: 'Snare found',
        metadata: { riskLevel: 'HIGH' },
      };

      await expect(service.recordIncident(invalidDto)).rejects.toThrow(
        DomainValidationError
      );
      await expect(service.recordIncident(invalidDto)).rejects.toThrow(
        /coordinates.*required/i
      );
    });

    it('should throw DomainValidationError if latitude exceeds boundaries (-90 to 90)', async () => {
      const outOfBoundsDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [120.5, 80.98], // 120.5 > 90
        description: 'Snare out of bounds',
        metadata: { riskLevel: 'LOW' },
      };

      await expect(service.recordIncident(outOfBoundsDto)).rejects.toThrow(
        /Latitude must be between -90 and 90/
      );
    });

    it('should throw DomainValidationError if longitude exceeds boundaries (-180 to 180)', async () => {
      const outOfBoundsDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [6.83, 195.0], // 195 > 180
        description: 'Snare out of bounds',
        metadata: { riskLevel: 'LOW' },
      };

      await expect(service.recordIncident(outOfBoundsDto)).rejects.toThrow(
        /Longitude must be between -180 and 180/
      );
    });

    it('should throw DomainValidationError if description is missing or blank', async () => {
      const blankDescriptionDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: '   ',
        metadata: { riskLevel: 'LOW' },
      };

      await expect(service.recordIncident(blankDescriptionDto)).rejects.toThrow(
        /description.*required/i
      );
    });
  });

  // ==========================================
  // 4. Negative: Strategy Pattern Validation
  // ==========================================
  describe('Negative: Strategy Pattern Validation', () => {
    it('should reject a CARCASS incident when decompositionState is missing', async () => {
      const invalidCarcassDto: CreateIncidentDTO = {
        type: 'CARCASS',
        coordinates: [6.842, 80.975],
        description: 'Dead deer found in bushes',
        metadata: {
          species: 'Deer',
          // missing decompositionState
        },
      };

      await expect(service.recordIncident(invalidCarcassDto)).rejects.toThrow(
        DomainValidationError
      );
      await expect(service.recordIncident(invalidCarcassDto)).rejects.toThrow(
        /decompositionState/
      );
    });

    it('should reject a SNARE incident when riskLevel is invalid', async () => {
      const invalidSnareDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'Snare found',
        metadata: {
          riskLevel: 'EXTREME' as any, // Not LOW, MEDIUM, HIGH, CRITICAL
        },
      };

      await expect(service.recordIncident(invalidSnareDto)).rejects.toThrow(
        /valid riskLevel/i
      );
    });

    it('should reject an ILLEGAL_CAMPSITE incident when campfireDetected is missing or not boolean', async () => {
      const invalidCampsiteDto: CreateIncidentDTO = {
        type: 'ILLEGAL_CAMPSITE',
        coordinates: [6.819, 80.962],
        description: 'Camp location',
        metadata: {
          campfireDetected: 'yes' as any, // not boolean
        },
      };

      await expect(service.recordIncident(invalidCampsiteDto)).rejects.toThrow(
        /campfireDetected.*boolean/i
      );
    });

    it('should reject an unsupported incident type', async () => {
      const unsupportedDto: any = {
        type: 'ALIEN_LANDING',
        coordinates: [6.834, 80.988],
        description: 'Unidentified craft',
        metadata: {},
      };

      await expect(service.recordIncident(unsupportedDto)).rejects.toThrow(
        /Unsupported incident type/i
      );
    });

    it('should reject a SNARE incident when snareCount is invalid (< 1)', async () => {
      const invalidCountDto: CreateIncidentDTO = {
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'Snare found',
        metadata: {
          riskLevel: 'LOW',
          snareCount: -1,
        },
      };

      await expect(service.recordIncident(invalidCountDto)).rejects.toThrow(
        /snareCount must be a positive integer/i
      );
    });

    it('should reject an ILLEGAL_CAMPSITE when estimatedPeople is invalid (< 1)', async () => {
      const invalidPeopleDto: CreateIncidentDTO = {
        type: 'ILLEGAL_CAMPSITE',
        coordinates: [6.819, 80.962],
        description: 'Camp location',
        metadata: {
          campfireDetected: false,
          estimatedPeople: 0,
        },
      };

      await expect(service.recordIncident(invalidPeopleDto)).rejects.toThrow(
        /estimatedPeople must be at least 1/i
      );
    });

    it('should successfully validate generic POACHING_SIGNS incident', async () => {
      const signsDto: CreateIncidentDTO = {
        type: 'POACHING_SIGNS',
        coordinates: [6.834, 80.988],
        description: 'Fresh boot prints heading towards river',
        metadata: { printCount: 4 },
      };

      mockRepository.create.mockImplementation(async (inc) => inc);
      const res = await service.recordIncident(signsDto);
      expect(res.type).toBe('POACHING_SIGNS');
    });

    it('should throw DomainValidationError if type is missing', async () => {
      const noTypeDto: any = {
        type: '',
        coordinates: [6.834, 80.988],
        description: 'Missing type',
        metadata: {},
      };

      await expect(service.recordIncident(noTypeDto)).rejects.toThrow(
        /type.*required/i
      );
    });
  });

  // ==========================================
  // 5. In-Memory Repository Integration Test
  // ==========================================
  describe('InMemoryIncidentRepository Integration', () => {
    it('should persist and query items correctly in InMemory repository', async () => {
      const realRepo = new InMemoryIncidentRepository(false);
      const realService = new IncidentService(realRepo, validationContext);

      const incident = await realService.recordIncident({
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'Active wire snare near boundary',
        metadata: { riskLevel: 'CRITICAL' },
      });

      expect(incident.id).toBeDefined();

      const all = await realService.getAllIncidents();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe(incident.id);

      const filteredByType = await realService.getAllIncidents({ type: 'SNARE' });
      expect(filteredByType.length).toBe(1);

      const filteredByNonExistent = await realService.getAllIncidents({ type: 'CARCASS' });
      expect(filteredByNonExistent.length).toBe(0);

      const filteredByStatus = await realService.getAllIncidents({ status: 'RECORDED' });
      expect(filteredByStatus.length).toBe(1);

      const fetched = await realService.getIncidentById(incident.id);
      expect(fetched).not.toBeNull();
      expect(fetched?.description).toBe('Active wire snare near boundary');

      const count = await realRepo.count();
      expect(count).toBe(1);

      await realRepo.clear();
      expect(await realRepo.count()).toBe(0);
    });

    it('should throw validation error on invalid getIncidentById query', async () => {
      await expect(service.getIncidentById('')).rejects.toThrow(DomainValidationError);
    });
  });
});
