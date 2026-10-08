import http from 'http';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app';
import { initializeAlertSocket } from './sockets/alert.socket';
import { CollarSimulator } from './services/collar-simulator';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/wildguard';

// Create HTTP server wrapping Express app
const server = http.createServer(app);

// Initialize Socket.io server
const io = initializeAlertSocket(server);

// Database Connection & Server Initialization
async function startServer() {
  try {
    console.log('[Database] Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('[Database] Connected to MongoDB successfully.');

    // Seed default geofence boundaries for testing
    await CollarSimulator.initDefaultZones();
  } catch (dbError: any) {
    console.warn(
      `[Database Warning] Could not connect to MongoDB at ${MONGO_URI}: ${dbError.message}`
    );
    console.warn(
      '[Database Warning] Running in demonstration mode. The telemetry simulator and socket broadcasts will continue.'
    );
  }

  // Start background GPS collar telemetry simulator
  CollarSimulator.start(4000);

  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` WildGuard Backend Server is running on port ${PORT}`);
    console.log(` Socket.io initialized & broadcasting events`);
    console.log(` Use Case 04: Respond to Animal Risk Alert is active`);
    console.log(`====================================================`);
  });
}

startServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
  CollarSimulator.stop();
  mongoose.connection.close();
  server.close();
});
