/**
 * UC-01: Record Wildlife Incident - Validation Strategies (Strategy Pattern)
 * 
 * SOLID Principles Applied:
 * - Strategy Pattern: Encapsulates validation algorithms inside separate classes.
 * - Open/Closed Principle (OCP): New incident types (e.g., FENCE_DAMAGE, POACHING_SIGNS) can
 *   be added by implementing `IIncidentValidationStrategy` and registering it into the context
 *   without changing existing validation classes.
 * - Single Responsibility Principle (SRP): Each strategy is solely responsible for validating
 *   its specific incident type's constraints.
 * - Liskov Substitution Principle (LSP): Any concrete strategy can be used interchangeably
 *   where `IIncidentValidationStrategy` is expected.
 */

import {
  CreateIncidentDTO,
  IncidentType,
  SnareRiskLevel,
  DecompositionState,
} from './incident.model';

export class DomainValidationError extends Error {
  public readonly statusCode: number = 400;
  constructor(message: string) {
    super(message);
    this.name = 'DomainValidationError';
    Object.setPrototypeOf(this, DomainValidationError.prototype);
  }
}

/**
 * Strategy Interface
 */
export interface IIncidentValidationStrategy {
  readonly supportedType: IncidentType;
  validate(dto: CreateIncidentDTO): void;
}

/**
 * Concrete Strategy 1: Snare Validation
 * Requirement: Must have a valid `riskLevel` ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
 */
export class SnareValidationStrategy implements IIncidentValidationStrategy {
  public readonly supportedType: IncidentType = 'SNARE';

  public validate(dto: CreateIncidentDTO): void {
    const metadata = dto.metadata;
    if (!metadata || typeof metadata !== 'object') {
      throw new DomainValidationError(
        "Snare incident requires metadata with 'riskLevel' (LOW, MEDIUM, HIGH, CRITICAL)."
      );
    }

    const validRiskLevels: SnareRiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
    if (!metadata.riskLevel || !validRiskLevels.includes(metadata.riskLevel)) {
      throw new DomainValidationError(
        `Snare incident requires a valid riskLevel. Received: '${metadata.riskLevel}'. Expected one of: ${validRiskLevels.join(', ')}.`
      );
    }

    if (metadata.snareCount !== undefined) {
      if (typeof metadata.snareCount !== 'number' || metadata.snareCount < 1) {
        throw new DomainValidationError(
          'snareCount must be a positive integer if provided.'
        );
      }
    }
  }
}

/**
 * Concrete Strategy 2: Carcass Validation
 * Requirement: Must have a valid `decompositionState` ('FRESH' | 'EARLY_DECOMP' | 'ADVANCED' | 'SKELETAL')
 */
export class CarcassValidationStrategy implements IIncidentValidationStrategy {
  public readonly supportedType: IncidentType = 'CARCASS';

  public validate(dto: CreateIncidentDTO): void {
    const metadata = dto.metadata;
    if (!metadata || typeof metadata !== 'object') {
      throw new DomainValidationError(
        "Carcass incident requires metadata with 'decompositionState' (FRESH, EARLY_DECOMP, ADVANCED, SKELETAL)."
      );
    }

    const validDecompStates: DecompositionState[] = [
      'FRESH',
      'EARLY_DECOMP',
      'ADVANCED',
      'SKELETAL',
    ];

    if (
      !metadata.decompositionState ||
      !validDecompStates.includes(metadata.decompositionState)
    ) {
      throw new DomainValidationError(
        `Carcass incident requires a valid decompositionState. Received: '${metadata.decompositionState}'. Expected one of: ${validDecompStates.join(', ')}.`
      );
    }
  }
}

/**
 * Concrete Strategy 3: Illegal Campsite Validation
 * Requirement: Must have `campfireDetected` boolean and valid optional `estimatedPeople` >= 1
 */
export class IllegalCampsiteValidationStrategy
  implements IIncidentValidationStrategy {
  public readonly supportedType: IncidentType = 'ILLEGAL_CAMPSITE';

  public validate(dto: CreateIncidentDTO): void {
    const metadata = dto.metadata;
    if (!metadata || typeof metadata !== 'object') {
      throw new DomainValidationError(
        "Illegal campsite incident requires metadata with 'campfireDetected' (boolean)."
      );
    }

    if (typeof metadata.campfireDetected !== 'boolean') {
      throw new DomainValidationError(
        "Illegal campsite incident requires 'campfireDetected' as a boolean flag."
      );
    }

    if (metadata.estimatedPeople !== undefined) {
      if (
        typeof metadata.estimatedPeople !== 'number' ||
        metadata.estimatedPeople < 1
      ) {
        throw new DomainValidationError(
          'estimatedPeople must be at least 1 if provided.'
        );
      }
    }
  }
}

/**
 * Concrete Strategy 4: Default Fallback Strategy for Generic/Other Types
 */
export class GenericIncidentValidationStrategy
  implements IIncidentValidationStrategy {
  public readonly supportedType: IncidentType;

  constructor(type: IncidentType) {
    this.supportedType = type;
  }

  public validate(_dto: CreateIncidentDTO): void {
    // Generic incidents do not require special metadata constraints
  }
}

/**
 * Strategy Context / Registry (Factory & Orchestrator)
 */
export class IncidentValidationStrategyContext {
  private strategies: Map<IncidentType, IIncidentValidationStrategy> = new Map();

  constructor() {
    // Register built-in default strategies
    this.registerStrategy(new SnareValidationStrategy());
    this.registerStrategy(new CarcassValidationStrategy());
    this.registerStrategy(new IllegalCampsiteValidationStrategy());
    this.registerStrategy(new GenericIncidentValidationStrategy('POACHING_SIGNS'));
    this.registerStrategy(new GenericIncidentValidationStrategy('FENCE_DAMAGE'));
  }

  /**
   * Registers a new validation strategy (Open for Extension)
   */
  public registerStrategy(strategy: IIncidentValidationStrategy): void {
    this.strategies.set(strategy.supportedType, strategy);
  }

  /**
   * Executes validation for the given DTO based on its incident type
   */
  public validate(dto: CreateIncidentDTO): void {
    if (!dto.type) {
      throw new DomainValidationError("Incident 'type' is required.");
    }

    const strategy = this.strategies.get(dto.type);
    if (!strategy) {
      throw new DomainValidationError(
        `Unsupported incident type: '${dto.type}'. Supported types: ${Array.from(
          this.strategies.keys()
        ).join(', ')}`
      );
    }

    strategy.validate(dto);
  }
}
