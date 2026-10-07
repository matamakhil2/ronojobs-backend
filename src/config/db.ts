import { Pool, PoolConfig } from 'pg';
import { ENV } from './env';

const isProduction = ENV.NODE_ENV === 'production' || ENV.DATABASE_URL.includes('render.com');

const poolConfig: PoolConfig = {
  connectionString: ENV.DATABASE_URL,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};
