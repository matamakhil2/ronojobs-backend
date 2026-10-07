import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import jobRoutes from './routes/jobRoutes';
import applicationRoutes from './routes/applicationRoutes';
import savedJobRoutes from './routes/savedJobRoutes';
import profileRoutes from './routes/profileRoutes';
import employerRoutes from './routes/employerRoutes';
import metaRoutes from './routes/metaRoutes';
import { errorHandler } from './middleware/error';
import { pool } from './config/db';

const app: Application = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check probe
app.get('/api/v1/health', async (_req: Request, res: Response) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      service: 'RonoJobs API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message || 'Database unavailable',
      service: 'RonoJobs API',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }
});

// Root welcome
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to RonoJobs API',
    docs: '/api/v1/health',
    version: '1.0.0'
  });
});

// API Routes mounted on /api/v1
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/jobs', jobRoutes);
app.use('/api/v1/applications', applicationRoutes);
app.use('/api/v1/saved-jobs', savedJobRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/employer', employerRoutes);
app.use('/api/v1/meta', metaRoutes);

// 404 Handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Endpoint not found' });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
