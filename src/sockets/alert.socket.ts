import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

let io: SocketIOServer | null = null;

export interface BreachAlertPayload {
  alertId: string;
  animalId: string;
  animalName: string;
  species: string;
  collarId: string;
  location: [number, number]; // [lat, lng]
  zoneName: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  cameraTrapImageUrl: string;
  timestamp: string;
  status: string;
  distanceToSettlementKm?: number;
}

export interface TelemetryPayload {
  collarId: string;
  animalName: string;
  species: string;
  location: [number, number];
  batteryLevel: number;
  speedKmh?: number;
  heading?: number;
  timestamp: string;
  isBreaching: boolean;
  breachZoneName?: string;
}

export interface DispatchUpdatePayload {
  dispatchId: string;
  status: 'ACTIVE' | 'ACCEPTED' | 'REJECTED' | 'RESOLVED';
  assignedRangerId?: string;
  assignedRangerName?: string;
  rejectionReason?: string;
  notes?: string;
  updatedAt: string;
}

/**
 * Initializes and registers Socket.io with the HTTP server.
 */
export function initializeAlertSocket(server: HttpServer): SocketIOServer {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  io = new SocketIOServer(server, {
    cors: {
      origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join role-specific channels or individual ranger channel
    socket.on('join:room', (room: string) => {
      socket.join(room);
      console.log(`[Socket.io] Client ${socket.id} joined room: ${room}`);
    });

    // Optional client-driven response to dispatch
    socket.on('ranger:respond', (data: { dispatchId: string; rangerId: string; action: 'ACCEPT' | 'REJECT'; reason?: string }) => {
      console.log(`[Socket.io] Ranger response received over socket:`, data);
      // Broadcast to managers and listeners
      io?.emit('dispatch:updated', data);
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}

/**
 * Returns the current SocketIOServer instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Broadcasts an animal geofence breach alert to all connected operators and rangers.
 */
export function emitAnimalBreach(data: BreachAlertPayload): void {
  if (io) {
    console.log(`[Socket.io] Emitting 'animal:breach' alert: ${data.animalName} in ${data.zoneName}`);
    io.emit('animal:breach', data);
  } else {
    console.warn('[Socket.io] Server not initialized yet when attempting to emit breach');
  }
}

/**
 * Broadcasts regular collar telemetry updates.
 */
export function emitTelemetryPing(data: TelemetryPayload): void {
  if (io) {
    io.emit('telemetry:ping', data);
  }
}

/**
 * Broadcasts dispatch state transitions (ACCEPTED, REJECTED, RESOLVED, etc.).
 */
export function emitDispatchUpdate(data: DispatchUpdatePayload): void {
  if (io) {
    console.log(`[Socket.io] Emitting 'dispatch:updated' for dispatch ${data.dispatchId} -> ${data.status}`);
    io.emit('dispatch:updated', data);
  }
}
