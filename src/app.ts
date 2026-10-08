import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import telemetryRoutes from './routes/telemetry.routes';
import conflictRoutes from './routes/conflict.routes';

dotenv.config();

const app: Application = express();

// Global Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());

// API Health Check
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    service: 'WildGuard Telemetry & Dispatch API',
    useCase: 'UC-04: Respond to Animal Risk Alert',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes under /api
app.use('/api', telemetryRoutes);
app.use('/api/conflicts', conflictRoutes);

export default app;
