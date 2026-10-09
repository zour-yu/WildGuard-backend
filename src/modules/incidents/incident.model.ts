/**
 * UC-01: Record Wildlife Incident - Model & DTO Definitions
 * 
 * SOLID Principles Applied:
 * - Single Responsibility Principle (SRP): This file exclusively defines data contracts,
 *   domain types, and interfaces representing Wildlife Incidents.
 * - Interface Segregation Principle (ISP): Metadata contracts are segregated per incident type
 *   (Snare, Carcass, Illegal Campsite) so clients only depend on the fields they require.
 */

export type IncidentType =
  | 'SNARE'
  | 'CARCASS'
  | 'ILLEGAL_CAMPSITE'
  | 'POACHING_SIGNS'
  | 'FENCE_DAMAGE';

export type SnareRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DecompositionState =
  | 'FRESH'
  | 'EARLY_DECOMP'
  | 'ADVANCED'
  | 'SKELETAL';

export type IncidentStatus =
  | 'RECORDED'
  | 'DISPATCHED'
  | 'UNDER_INVESTIGATION'
  | 'RESOLVED';

/**
 * Type-specific metadata contracts (ISP)
 */
export interface SnareMetadata {
  riskLevel: SnareRiskLevel;
  snareCount?: number;
  wireType?: 'STEEL_CABLE' | 'NYLON' | 'BRAIDED_WIRE' | 'OTHER';
  isArmed?: boolean;
  targetSpecies?: string;
}

export interface CarcassMetadata {
  decompositionState: DecompositionState;
  species?: string;
  estimatedAgeDays?: number;
  causeOfDeath?: 'POACHING' | 'NATURAL' | 'PREDATION' | 'POISONING' | 'UNKNOWN';
  ivoryRemoved?: boolean;
  hornsRemoved?: boolean;
}

export interface IllegalCampsiteMetadata {
  campfireDetected: boolean;
  estimatedPeople?: number;
  campsiteActive?: boolean;
  litterPresent?: boolean;
  structureType?: 'TENT' | 'MAKESHIFT_SHELTER' | 'LEAN_TO' | 'NONE';
}

export type IncidentMetadata =
  | SnareMetadata
  | CarcassMetadata
  | IllegalCampsiteMetadata
  | Record<string, any>;

/**
 * Domain Entity: Incident
 */
export interface Incident {
  id: string; // Unique UUID (generated on client for offline sync or server)
  type: IncidentType;
  coordinates: [number, number]; // [Latitude, Longitude]
  description: string;
  photoUrl?: string; // Base64 data URL or external asset URL
  metadata: IncidentMetadata;
  reporterId: string;
  reporterName: string;
  status: IncidentStatus;
  timestamp: Date;
  syncedFromOffline: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Data Transfer Objects (DTOs)
 */
export interface CreateIncidentDTO {
  id?: string; // Optional client-generated UUID for offline idempotency
  type: IncidentType;
  coordinates: [number, number];
  description: string;
  photoUrl?: string;
  metadata?: Record<string, any>;
  reporterId?: string;
  reporterName?: string;
  timestamp?: string | Date;
}

export interface SyncIncidentsDTO {
  incidents: CreateIncidentDTO[];
}

export interface SyncResponseDTO {
  success: boolean;
  processedCount: number;
  createdCount: number;
  duplicatesCount: number;
  created: Incident[];
  skippedDuplicates: string[];
  timestamp: string;
}
