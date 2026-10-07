import app from './app';
import { ENV } from './config/env';
import { pool } from './config/db';
import { runMigrations } from './db/migrate';

async function startServer() {
  try {
    // Verify PostgreSQL connection
    const client = await pool.connect();
    console.log('📦 Connected to PostgreSQL database successfully.');
    client.release();

    // Auto-run schema migration if needed
    try {
      await runMigrations();
    } catch (migErr) {
      console.warn('⚠️ Migration note:', migErr);
    }

    app.listen(ENV.PORT, () => {
      console.log(`🚀 RonoJobs Backend API running at http://localhost:${ENV.PORT}`);
      console.log(`📡 Health endpoint: http://localhost:${ENV.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
