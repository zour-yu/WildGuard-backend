import { AlertDispatch, IAlertDispatch, AlertStatus } from '../models/AlertDispatch';
import { emitDispatchUpdate } from '../sockets/alert.socket';

export interface RangerInfo {
  rangerId: string;
  name: string;
  callsign: string;
  status: 'AVAILABLE' | 'ON_PATROL' | 'BUSY';
  location: [number, number];
  batteryLevel: number;
}

// Simulated field rangers deployed across park sectors
export const MOCK_RANGERS: RangerInfo[] = [
  {
    rangerId: 'RNG-001',
    name: 'Sgt. Tharaka Bandara',
    callsign: 'Kestrel-1',
    status: 'AVAILABLE',
    location: [6.832, 80.985],
    batteryLevel: 94,
  },
  {
    rangerId: 'RNG-002',
    name: 'Officer Nimal Silva',
    callsign: 'Rhino-3',
    status: 'AVAILABLE',
    location: [6.828, 80.978],
    batteryLevel: 88,
  },
  {
    rangerId: 'RNG-003',
    name: 'Officer Chaminda Perera',
    callsign: 'Eagle-2',
    status: 'ON_PATROL',
    location: [6.845, 80.992],
    batteryLevel: 76,
  },
  {
    rangerId: 'RNG-004',
    name: 'Ranger Dilshan Jayasinghe',
    callsign: 'Falcon-4',
    status: 'AVAILABLE',
    location: [6.822, 80.981],
    batteryLevel: 92,
  },
];

export class DispatchService {
  /**
   * Retrieves all active/unresolved breach alerts.
   */
  public static async getActiveAlerts(): Promise<IAlertDispatch[]> {
    return AlertDispatch.find({
      status: { $in: ['ACTIVE', 'ACCEPTED', 'REJECTED'] },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Retrieves all alerts with pagination/sorting.
   */
  public static async getAllAlerts(): Promise<IAlertDispatch[]> {
    return AlertDispatch.find().sort({ createdAt: -1 }).limit(50).exec();
  }

  /**
   * Retrieves a single alert by ID.
   */
  public static async getAlertById(id: string): Promise<IAlertDispatch | null> {
    return AlertDispatch.findById(id).exec();
  }

  /**
   * Dispatches a field ranger to an active animal breach alert.
   */
  public static async assignRanger(
    alertId: string,
    rangerId: string,
    rangerName?: string,
    notes?: string
  ): Promise<IAlertDispatch> {
    const alert = await AlertDispatch.findById(alertId);
    if (!alert) {
      throw new Error(`Breach Alert with ID ${alertId} not found.`);
    }

    const matchedRanger = MOCK_RANGERS.find((r) => r.rangerId === rangerId);
    const assignedName = rangerName || matchedRanger?.name || `Ranger ${rangerId}`;

    alert.assignedRangerId = rangerId;
    alert.assignedRangerName = assignedName;
    alert.dispatchedAt = new Date();
    alert.status = 'ACTIVE'; // Remains active awaiting ranger response
    if (notes) {
      alert.notes = notes;
    }

    const updatedAlert = await alert.save();

    // Broadcast dispatch assignment via Socket.io
    emitDispatchUpdate({
      dispatchId: updatedAlert._id.toString(),
      status: updatedAlert.status,
      assignedRangerId: updatedAlert.assignedRangerId,
      assignedRangerName: updatedAlert.assignedRangerName,
      notes: updatedAlert.notes,
      updatedAt: new Date().toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Handles ranger acceptance or rejection from the Ranger Field Terminal.
   */
  public static async respondToDispatch(
    dispatchId: string,
    rangerId: string,
    action: 'ACCEPT' | 'REJECT',
    reasonOrNotes?: string
  ): Promise<IAlertDispatch> {
    const alert = await AlertDispatch.findById(dispatchId);
    if (!alert) {
      throw new Error(`Dispatch with ID ${dispatchId} not found.`);
    }

    const now = new Date();

    if (action === 'ACCEPT') {
      alert.status = 'ACCEPTED';
      alert.acceptedAt = now;
      if (reasonOrNotes) {
        alert.notes = alert.notes
          ? `${alert.notes} | Ranger note: ${reasonOrNotes}`
          : `Ranger note: ${reasonOrNotes}`;
      }
    } else if (action === 'REJECT') {
      alert.status = 'REJECTED';
      alert.rejectedAt = now;
      alert.rejectionReason =
        reasonOrNotes || 'Ranger unable to respond - out of sector';
    }

    const updatedAlert = await alert.save();

    // Broadcast status change to operations dashboard
    emitDispatchUpdate({
      dispatchId: updatedAlert._id.toString(),
      status: updatedAlert.status,
      assignedRangerId: updatedAlert.assignedRangerId,
      assignedRangerName: updatedAlert.assignedRangerName,
      rejectionReason: updatedAlert.rejectionReason,
      notes: updatedAlert.notes,
      updatedAt: now.toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Resolves an alert on-scene and provides handoff to UC-01 (Record Wildlife Incident).
   */
  public static async resolveDispatch(
    dispatchId: string,
    resolutionNotes: string,
    incidentHandoffId?: string
  ): Promise<IAlertDispatch> {
    const alert = await AlertDispatch.findById(dispatchId);
    if (!alert) {
      throw new Error(`Dispatch with ID ${dispatchId} not found.`);
    }

    const now = new Date();
    alert.status = 'RESOLVED';
    alert.resolvedAt = now;
    alert.notes = alert.notes
      ? `${alert.notes} | Resolution: ${resolutionNotes}`
      : `Resolution: ${resolutionNotes}`;

    // Link handoff ID for UC-01
    alert.incidentHandoffId =
      incidentHandoffId || `INC-${Date.now().toString().slice(-6)}`;

    const updatedAlert = await alert.save();

    emitDispatchUpdate({
      dispatchId: updatedAlert._id.toString(),
      status: updatedAlert.status,
      notes: updatedAlert.notes,
      updatedAt: now.toISOString(),
    });

    return updatedAlert;
  }

  /**
   * Returns simulated ranger personnel.
   */
  public static getAvailableRangers(): RangerInfo[] {
    return MOCK_RANGERS;
  }
}
