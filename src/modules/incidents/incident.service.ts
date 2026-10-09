/**
 * UC-01: Record Wildlife Incident - Service Layer
 * 
 * SOLID Principles Applied:
 * - Single Responsibility Principle (SRP): Coordinates business workflow (coordinate sanity,
 *   type strategy dispatching, offline sync batching, deduplication) without coupling to transport or DB.
 * - Dependency Inversion Principle (DIP): Injects `IIncidentRepository` and `IncidentValidationStrategyContext`
 *   abstractions, making the business layer testable with 100% mocked dependencies.
 * - Open/Closed Principle (OCP): New incident types are supported automatically through the injected
 *   validation context without editing this service file.
 */

import {
  Incident,
  CreateIncidentDTO,
  SyncIncidentsDTO,
  SyncResponseDTO,
  IncidentType,
} from './incident.model';
import { IIncidentRepository } from './incident.repository';
import {
  IncidentValidationStrategyContext,
  DomainValidationError,
} from './incident.strategy';

export class IncidentService {
  private repository: IIncidentRepository;
  private validationContext: IncidentValidationStrategyContext;

  constructor(
    repository: IIncidentRepository,
    validationContext: IncidentValidationStrategyContext = new IncidentValidationStrategyContext()
  ) {
    this.repository = repository;
    this.validationContext = validationContext;
  }

  /**
   * Validates and records a single wildlife incident (online submission).
   */
  public async recordIncident(dto: CreateIncidentDTO): Promise<Incident> {
    // 1. Base validation
    this.validateBaseFields(dto);

    // 2. Strategy Pattern validation per incident type
    this.validationContext.validate(dto);

    const now = new Date();
    const incidentId =
      dto.id ||
      `INC-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // 3. Assemble entity
    const incident: Incident = {
      id: incidentId,
      type: dto.type,
      coordinates: dto.coordinates,
      description: dto.description.trim(),
      photoUrl: dto.photoUrl,
      metadata: dto.metadata || {},
      reporterId: dto.reporterId || 'RNG-CURRENT',
      reporterName: dto.reporterName || 'Field Ranger',
      status: 'RECORDED',
      timestamp: dto.timestamp ? new Date(dto.timestamp) : now,
      syncedFromOffline: !!dto.id, // If client provided a pre-generated ID, it originated from offline queue
      createdAt: now,
      updatedAt: now,
    };

    // 4. Persist via repository
    return this.repository.create(incident);
  }

  /**
   * Batch synchronization endpoint for flushing offline-queued incidents.
   * Deduplicates using unique client-generated IDs.
   */
  public async syncOfflineBatch(
    dto: SyncIncidentsDTO
  ): Promise<SyncResponseDTO> {
    if (!dto || !Array.isArray(dto.incidents)) {
      throw new DomainValidationError(
        "Invalid sync payload: 'incidents' must be an array."
      );
    }

    if (dto.incidents.length === 0) {
      return {
        success: true,
        processedCount: 0,
        createdCount: 0,
        duplicatesCount: 0,
        created: [],
        skippedDuplicates: [],
        timestamp: new Date().toISOString(),
      };
    }

    const validatedEntities: Incident[] = [];

    for (let i = 0; i < dto.incidents.length; i++) {
      const item = dto.incidents[i];

      try {
        this.validateBaseFields(item);
        this.validationContext.validate(item);
      } catch (err: any) {
        throw new DomainValidationError(
          `Validation failed at index ${i} (${item.type || 'UNKNOWN'}): ${err.message}`
        );
      }

      const now = new Date();
      const entityId =
        item.id ||
        `OFF-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      validatedEntities.push({
        id: entityId,
        type: item.type,
        coordinates: item.coordinates,
        description: item.description.trim(),
        photoUrl: item.photoUrl,
        metadata: item.metadata || {},
        reporterId: item.reporterId || 'RNG-OFFLINE',
        reporterName: item.reporterName || 'Field Ranger (Offline)',
        status: 'RECORDED',
        timestamp: item.timestamp ? new Date(item.timestamp) : now,
        syncedFromOffline: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Repository handles batch insertion & client-generated ID deduplication
    const { created, skipped } = await this.repository.createBatch(
      validatedEntities
    );

    return {
      success: true,
      processedCount: dto.incidents.length,
      createdCount: created.length,
      duplicatesCount: skipped.length,
      created,
      skippedDuplicates: skipped,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Retrieves all recorded incidents.
   */
  public async getAllIncidents(filter?: {
    type?: IncidentType;
    status?: string;
  }): Promise<Incident[]> {
    return this.repository.findAll(filter);
  }

  /**
   * Retrieves a single incident by ID.
   */
  public async getIncidentById(id: string): Promise<Incident | null> {
    if (!id || typeof id !== 'string') {
      throw new DomainValidationError('A valid incident ID string is required.');
    }
    return this.repository.findById(id);
  }

  /**
   * Common validation logic for base fields
   */
  private validateBaseFields(dto: CreateIncidentDTO): void {
    if (!dto) {
      throw new DomainValidationError('Incident payload is required.');
    }

    // 1. Description validation
    if (
      !dto.description ||
      typeof dto.description !== 'string' ||
      dto.description.trim().length === 0
    ) {
      throw new DomainValidationError(
        "Field 'description' is required and cannot be empty."
      );
    }

    // 2. Coordinates validation (Lat, Lng)
    if (
      !dto.coordinates ||
      !Array.isArray(dto.coordinates) ||
      dto.coordinates.length !== 2
    ) {
      throw new DomainValidationError(
        "Field 'coordinates' is required as a [latitude, longitude] array."
      );
    }

    const [lat, lng] = dto.coordinates;

    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      isNaN(lat) ||
      isNaN(lng)
    ) {
      throw new DomainValidationError(
        'Coordinates must contain valid numerical latitude and longitude values.'
      );
    }

    if (lat < -90 || lat > 90) {
      throw new DomainValidationError(
        `Latitude must be between -90 and 90 degrees. Received: ${lat}`
      );
    }

    if (lng < -180 || lng > 180) {
      throw new DomainValidationError(
        `Longitude must be between -180 and 180 degrees. Received: ${lng}`
      );
    }
  }
}
