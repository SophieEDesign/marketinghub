/**
 * Supabase Configuration
 * Configures NocoDB to use Supabase PostgreSQL database
 */

import type { DbConfig } from '~/interface/config';

/**
 * Get Supabase database configuration
 * Reads from environment variables:
 * - SUPABASE_DB_HOST
 * - SUPABASE_DB_PORT
 * - SUPABASE_DB_NAME
 * - SUPABASE_DB_USER
 * - SUPABASE_DB_PASSWORD
 * - SUPABASE_DB_SSL (optional, defaults to true)
 */
export function getSupabaseDbConfig(): DbConfig {
  const host = process.env.SUPABASE_DB_HOST || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '') || 'localhost';
  const port = parseInt(process.env.SUPABASE_DB_PORT || '5432', 10);
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.SUPABASE_DB_PASSWORD || '';
  const ssl = process.env.SUPABASE_DB_SSL !== 'false'; // Default to true for Supabase

  if (!password) {
    console.warn('SUPABASE_DB_PASSWORD not set. Database connection may fail.');
  }

  return {
    client: 'pg', // PostgreSQL
    connection: {
      host,
      port,
      database,
      user,
      password,
      ssl: ssl ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: 2,
      max: 10,
    },
    acquireConnectionTimeout: 60000,
    meta: {
      dbAlias: 'supabase',
      metaTables: 'db',
      api: {
        type: 'rest',
        prefix: '/api/v1/db',
      },
    },
  };
}

/**
 * Get Supabase connection string
 */
export function getSupabaseConnectionString(): string {
  const host = process.env.SUPABASE_DB_HOST || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '') || 'localhost';
  const port = process.env.SUPABASE_DB_PORT || '5432';
  const database = process.env.SUPABASE_DB_NAME || 'postgres';
  const user = process.env.SUPABASE_DB_USER || 'postgres';
  const password = process.env.SUPABASE_DB_PASSWORD || '';

  return `pg://${host}:${port}?u=${user}&p=${password}&d=${database}`;
}
