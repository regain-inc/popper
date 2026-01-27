/**
 * Database connection utilities
 * @module db
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Create a Drizzle database instance
 *
 * @param connectionString - PostgreSQL connection string
 * @param options - Additional postgres.js options
 */
export function createDB(
  connectionString: string,
  // biome-ignore lint/suspicious/noExplicitAny: postgres.js options type compatibility
  options?: postgres.Options<Record<string, postgres.PostgresType<any>>>,
): DrizzleDB {
  const client = postgres(connectionString, {
    max: 10, // Connection pool size
    idle_timeout: 20,
    ...options,
  });

  return drizzle(client, { schema });
}

/**
 * Create a Drizzle database instance for migrations
 * Uses a single connection without pooling
 */
export function createMigrationDB(connectionString: string): DrizzleDB {
  const client = postgres(connectionString, { max: 1 });
  return drizzle(client, { schema });
}
