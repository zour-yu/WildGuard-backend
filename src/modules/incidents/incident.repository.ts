/**
 * UC-01: Record Wildlife Incident - Repository Layer (Repository Pattern)
 * 
 * SOLID Principles Applied:
 * - Dependency Inversion Principle (DIP): High-level modules (IncidentService) depend
 *   on the abstraction `IIncidentRepository`, not concrete storage mechanisms.
 * - Single Responsibility Principle (SRP): This repository is exclusively responsible
 *   for data access, persistence, querying, and deduplication logic.
 * - Liskov Substitution Principle (LSP): Any repository implementation (InMemory, MongoDB, Prisma)
 *   can replace `InMemoryIncidentRepository` without breaking system consumers.
 */

import { Incident, IncidentType } from './incident.model';

export interface IIncidentRepository {
  create(incident: Incident): Promise<Incident>;
  findById(id: string): Promise<Incident | null>;
  findAll(filter?: { type?: IncidentType; status?: string }): Promise<Incident[]>;
  createBatch(
    incidents: Incident[]
  ): Promise<{ created: Incident[]; skipped: string[] }>;
  count(): Promise<number>;
  clear(): Promise<void>;
}

/**
 * In-Memory Repository Implementation with Built-in Deduplication
 */
export class InMemoryIncidentRepository implements IIncidentRepository {
  private storage: Map<string, Incident> = new Map();

  constructor(seedData: boolean = true) {
    if (seedData) {
      this.seedDefaultIncidents();
    }
  }

  public async create(incident: Incident): Promise<Incident> {
    // Deduplication check: if ID already exists, return existing or throw
    if (this.storage.has(incident.id)) {
      return this.storage.get(incident.id)!;
    }
    this.storage.set(incident.id, incident);
    return incident;
  }

  public async findById(id: string): Promise<Incident | null> {
    return this.storage.get(id) || null;
  }

  public async findAll(filter?: {
    type?: IncidentType;
    status?: string;
  }): Promise<Incident[]> {
    let list = Array.from(this.storage.values());

    if (filter?.type) {
      list = list.filter((item) => item.type === filter.type);
    }
    if (filter?.status) {
      list = list.filter((item) => item.status === filter.status);
    }

    // Sort newest first
    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Batch ingestion with client-generated ID deduplication
   */
  public async createBatch(
    incidents: Incident[]
  ): Promise<{ created: Incident[]; skipped: string[] }> {
    const created: Incident[] = [];
    const skipped: string[] = [];

    for (const incident of incidents) {
      if (this.storage.has(incident.id)) {
        skipped.push(incident.id);
      } else {
        this.storage.set(incident.id, incident);
        created.push(incident);
      }
    }

    return { created, skipped };
  }

  public async count(): Promise<number> {
    return this.storage.size;
  }

  public async clear(): Promise<void> {
    this.storage.clear();
  }

  /**
   * Initial mock dataset for park demonstration
   */
  private seedDefaultIncidents(): void {
    const sampleIncidents: Incident[] = [
      {
        id: 'INC-2026-001',
        type: 'SNARE',
        coordinates: [6.834, 80.988],
        description: 'Heavy steel wire snare found tethered to teak trunk near watering channel.',
        photoUrl: 'https://images.unsplash.com/photo-1575550959106-5a7defe28b56?auto=format&fit=crop&w=400&q=80',
        metadata: {
          riskLevel: 'HIGH',
          snareCount: 2,
          wireType: 'STEEL_CABLE',
          isArmed: true,
          targetSpecies: 'Wild Boar / Deer',
        },
        reporterId: 'RNG-001',
        reporterName: 'Sgt. Tharaka Bandara',
        status: 'DISPATCHED',
        timestamp: new Date(Date.now() - 3600000 * 4),
        syncedFromOffline: false,
        createdAt: new Date(Date.now() - 3600000 * 4),
        updatedAt: new Date(Date.now() - 3600000 * 4),
      },
      {
        id: 'INC-2026-002',
        type: 'CARCASS',
        coordinates: [6.842, 80.975],
        description: 'Adult sambar deer carcass discovered in Northern buffer scrubland.',
        photoUrl: 'https://images.unsplash.com/photo-1547721064-da6cfb341d50?auto=format&fit=crop&w=400&q=80',
        metadata: {
          decompositionState: 'EARLY_DECOMP',
          species: 'Sambar Deer (Rusa unicolor)',
          causeOfDeath: 'POACHING',
          estimatedAgeDays: 1,
        },
        reporterId: 'RNG-002',
        reporterName: 'Officer Nimal Silva',
        status: 'UNDER_INVESTIGATION',
        timestamp: new Date(Date.now() - 3600000 * 8),
        syncedFromOffline: true,
        createdAt: new Date(Date.now() - 3600000 * 8),
        updatedAt: new Date(Date.now() - 3600000 * 8),
      },
    ];

    for (const inc of sampleIncidents) {
      this.storage.set(inc.id, inc);
    }
  }
}
