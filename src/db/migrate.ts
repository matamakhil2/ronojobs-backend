import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations() {
  console.log('🔄 Running database migrations...');
  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  }
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Ensure pgcrypto or gen_random_uuid support
    await client.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('✅ Migrations executed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
