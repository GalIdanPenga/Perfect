import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeSchema } from './schema';
import { createFlowDb } from './flowDb';
import { createRunDb } from './runDb';
import { createStatsDb } from './statsDb';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type FlowDb = ReturnType<typeof createFlowDb>;
export type RunDb = ReturnType<typeof createRunDb>;
export type StatsDb = ReturnType<typeof createStatsDb>;

export interface DatabaseDeps {
  flowDb: FlowDb;
  runDb: RunDb;
  statsDb: StatsDb;
}

/**
 * Create an isolated database instance. Pass ':memory:' for in-memory (test) databases.
 */
export function createDatabase(dbPath: string): DatabaseDeps {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  initializeSchema(db);
  return {
    flowDb: createFlowDb(db),
    runDb: createRunDb(db),
    statsDb: createStatsDb(db)
  };
}

// Singleton for production use. PERFECT_DB_PATH overrides the location so tests
// (and other environments) can point at an isolated/in-memory database.
const dbPath = process.env.PERFECT_DB_PATH || path.join(__dirname, 'flows.db');
const defaultDeps = createDatabase(dbPath);
console.log('Database initialized successfully at:', dbPath);

export const flowDb = defaultDeps.flowDb;
export const runDb = defaultDeps.runDb;
export const statsDb = defaultDeps.statsDb;

// Keep default export as an opaque marker (not the raw db) for backward compat
export default defaultDeps;
