import app from './app';
import { ENV } from './config/env';
import { pool } from './config/db';
import { runMigrations } from './db/migrate';

async function startServer() {
  // Attempt PostgreSQL connection and migrations
  try {
    const client = await pool.connect();
    console.log('📦 Connected to PostgreSQL database successfully.');
    client.release();

    try {
      await runMigrations();
    } catch (migErr) {
      console.warn('⚠️ Migration note:', migErr);
    }
  } catch (dbErr: any) {
    console.warn('⚠️ PostgreSQL is temporarily unavailable during startup:', dbErr.message);
    console.warn('ℹ️ Server will start in standby mode. Health check will report 503 until PostgreSQL is reachable.');
  }

  // Start HTTP listener
  app.listen(ENV.PORT, () => {
    console.log(`🚀 RonoJobs Backend API running at http://localhost:${ENV.PORT}`);
    console.log(`📡 Health endpoint: http://localhost:${ENV.PORT}/api/v1/health`);
  });
}

startServer();
