import Database from 'better-sqlite3';

export type Db = InstanceType<typeof Database>;

/**
 * Create all tables/indexes (idempotent) and run the additive column
 * migrations. Safe to call on every startup.
 */
export function initializeSchema(db: Db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      code_snippet TEXT,
      tags TEXT,
      created_at TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      weight INTEGER NOT NULL DEFAULT 1,
      estimated_time INTEGER NOT NULL,
      crucial_pass INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_runs (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL,
      flow_name TEXT NOT NULL,
      state TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      configuration TEXT NOT NULL,
      tags TEXT,
      progress REAL NOT NULL DEFAULT 0,
      client_color TEXT,
      client_name TEXT,
      report_path TEXT
    )
  `);

  // Migration: Add client_name column if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_runs ADD COLUMN client_name TEXT`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Migration: Add client_color column if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_runs ADD COLUMN client_color TEXT`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Migration: Add report_path column if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_runs ADD COLUMN report_path TEXT`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Migration: Add crucial_pass column to tasks if it doesn't exist
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN crucial_pass INTEGER NOT NULL DEFAULT 1`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_runs (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      task_name TEXT NOT NULL,
      state TEXT NOT NULL,
      start_time TEXT,
      end_time TEXT,
      duration_ms INTEGER,
      weight REAL NOT NULL,
      estimated_time INTEGER NOT NULL,
      progress REAL NOT NULL DEFAULT 0,
      result TEXT,
      crucial_pass INTEGER,
      performance_warning TEXT,
      FOREIGN KEY (run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add result column to task_runs if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_runs ADD COLUMN result TEXT`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Migration: Add crucial_pass column to task_runs if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_runs ADD COLUMN crucial_pass INTEGER`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      log_entry TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      task_run_id TEXT NOT NULL,
      log_entry TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES flow_runs(id) ON DELETE CASCADE,
      FOREIGN KEY (task_run_id) REFERENCES task_runs(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS task_statistics (
      flow_name TEXT NOT NULL,
      task_name TEXT NOT NULL,
      avg_duration_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      m2 REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (flow_name, task_name)
    )
  `);

  // Migration: Add m2 column to task_statistics if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_statistics ADD COLUMN m2 REAL NOT NULL DEFAULT 0`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_statistics (
      flow_name TEXT PRIMARY KEY,
      avg_duration_ms REAL NOT NULL,
      sample_count INTEGER NOT NULL,
      last_updated TEXT NOT NULL,
      m2 REAL NOT NULL DEFAULT 0
    )
  `);

  // Migration: Add m2 column to flow_statistics if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_statistics ADD COLUMN m2 REAL NOT NULL DEFAULT 0`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  // Migration: Add performance_warning column to task_runs if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_runs ADD COLUMN performance_warning TEXT`);
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) throw e;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS flow_task_structure (
      flow_name TEXT NOT NULL,
      task_index INTEGER NOT NULL,
      task_name TEXT NOT NULL,
      estimated_time INTEGER NOT NULL DEFAULT 1000,
      last_updated TEXT NOT NULL,
      PRIMARY KEY (flow_name, task_index)
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_flow_id ON tasks(flow_id);
    CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_run_id ON task_runs(run_id);
    CREATE INDEX IF NOT EXISTS idx_logs_run_id ON logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_run_id ON task_logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_run_id ON task_logs(task_run_id);
    CREATE INDEX IF NOT EXISTS idx_flow_task_structure_flow_name ON flow_task_structure(flow_name);
  `);
}
