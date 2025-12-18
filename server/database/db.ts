import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { FlowDefinition, FlowRun } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'flows.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent access
db.pragma('journal_mode = WAL');

// Initialize database schema
function initializeDatabase() {
  // Create flows table
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

  // Create tasks table (normalized)
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

  // Create flow_runs table
  // Note: No foreign key constraint on flow_id to allow runs to persist after flow deletion
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
      client_color TEXT
    )
  `);

  // Migration: Add client_color column if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_runs ADD COLUMN client_color TEXT`);
    console.log('[Database] Added client_color column to flow_runs table');
  } catch (e: any) {
    // Column already exists, ignore error
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Migration: Add report_path column if it doesn't exist
  try {
    db.exec(`ALTER TABLE flow_runs ADD COLUMN report_path TEXT`);
    console.log('[Database] Added report_path column to flow_runs table');
  } catch (e: any) {
    // Column already exists, ignore error
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Migration: Add crucial_pass column to tasks if it doesn't exist
  try {
    db.exec(`ALTER TABLE tasks ADD COLUMN crucial_pass INTEGER NOT NULL DEFAULT 1`);
    console.log('[Database] Added crucial_pass column to tasks table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Create task_runs table
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
      FOREIGN KEY (run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add result column to task_runs if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_runs ADD COLUMN result TEXT`);
    console.log('[Database] Added result column to task_runs table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Create logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL,
      log_entry TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES flow_runs(id) ON DELETE CASCADE
    )
  `);

  // Create task_logs table
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

  // Create task_statistics table for tracking historical performance
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
    console.log('[Database] Added m2 column to task_statistics table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Create flow_statistics table for tracking flow-level performance
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
    console.log('[Database] Added m2 column to flow_statistics table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Migration: Add performance_warning column to task_runs if it doesn't exist
  try {
    db.exec(`ALTER TABLE task_runs ADD COLUMN performance_warning TEXT`);
    console.log('[Database] Added performance_warning column to task_runs table');
  } catch (e: any) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // Create flow_task_structure table for storing learned task structures from actual execution
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

  // Create indices for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_flow_id ON tasks(flow_id);
    CREATE INDEX IF NOT EXISTS idx_flow_runs_flow_id ON flow_runs(flow_id);
    CREATE INDEX IF NOT EXISTS idx_task_runs_run_id ON task_runs(run_id);
    CREATE INDEX IF NOT EXISTS idx_logs_run_id ON logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_run_id ON task_logs(run_id);
    CREATE INDEX IF NOT EXISTS idx_task_logs_task_run_id ON task_logs(task_run_id);
    CREATE INDEX IF NOT EXISTS idx_flow_task_structure_flow_name ON flow_task_structure(flow_name);
  `);

  console.log('Database initialized successfully at:', dbPath);
}

// Initialize on import
initializeDatabase();

// Flow operations
export const flowDb = {
  // Save a flow definition
  saveFlow(flow: FlowDefinition) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO flows (id, name, description, code_snippet, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      flow.id,
      flow.name,
      flow.description,
      flow.codeSnippet,
      JSON.stringify(flow.tags || {}),
      flow.createdAt
    );

    // Delete existing tasks for this flow
    db.prepare('DELETE FROM tasks WHERE flow_id = ?').run(flow.id);

    // Insert tasks
    const taskStmt = db.prepare(`
      INSERT INTO tasks (id, flow_id, name, description, weight, estimated_time, crucial_pass)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const task of flow.tasks) {
      taskStmt.run(
        task.id,
        flow.id,
        task.name,
        task.description,
        task.weight,
        task.estimatedTime,
        task.crucialPass ? 1 : 0
      );
    }
  },

  // Get all flows
  getAllFlows(): FlowDefinition[] {
    const flows = db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all() as any[];

    return flows.map(flow => {
      const tasks = db.prepare('SELECT * FROM tasks WHERE flow_id = ? ORDER BY rowid').all(flow.id) as any[];

      return {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        codeSnippet: flow.code_snippet,
        tags: flow.tags ? JSON.parse(flow.tags) : {},
        createdAt: flow.created_at,
        tasks: tasks.map(task => ({
          id: task.id,
          name: task.name,
          description: task.description,
          weight: task.weight,
          estimatedTime: task.estimated_time,
          crucialPass: task.crucial_pass === 1
        }))
      };
    });
  },

  // Get a specific flow by ID
  getFlowById(flowId: string): FlowDefinition | undefined {
    const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId) as any;

    if (!flow) return undefined;

    const tasks = db.prepare('SELECT * FROM tasks WHERE flow_id = ? ORDER BY rowid').all(flowId) as any[];

    return {
      id: flow.id,
      name: flow.name,
      description: flow.description,
      codeSnippet: flow.code_snippet,
      tags: flow.tags ? JSON.parse(flow.tags) : {},
      createdAt: flow.created_at,
      tasks: tasks.map(task => ({
        id: task.id,
        name: task.name,
        description: task.description,
        weight: task.weight,
        estimatedTime: task.estimated_time,
        crucialPass: task.crucial_pass === 1
      }))
    };
  },

  // Delete a flow
  deleteFlow(flowId: string) {
    db.prepare('DELETE FROM flows WHERE id = ?').run(flowId);
  }
};

// Flow run operations
export const runDb = {
  // Save a flow run
  saveRun(run: FlowRun) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO flow_runs
      (id, flow_id, flow_name, state, start_time, end_time, configuration, tags, progress, client_color, report_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      run.id,
      run.flowId,
      run.flowName,
      run.state,
      run.startTime,
      run.endTime || null,
      run.configuration,
      JSON.stringify(run.tags || {}),
      run.progress,
      run.clientColor || null,
      run.reportPath || null
    );

    // Delete existing task runs and logs for this run
    db.prepare('DELETE FROM task_runs WHERE run_id = ?').run(run.id);
    db.prepare('DELETE FROM logs WHERE run_id = ?').run(run.id);
    db.prepare('DELETE FROM task_logs WHERE run_id = ?').run(run.id);

    // Insert task runs
    const taskStmt = db.prepare(`
      INSERT INTO task_runs
      (id, run_id, task_id, task_name, state, start_time, end_time, duration_ms, weight, estimated_time, progress, result, performance_warning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const task of run.tasks) {
      taskStmt.run(
        task.id,
        run.id,
        task.taskId,
        task.taskName,
        task.state,
        task.startTime || null,
        task.endTime || null,
        task.durationMs || null,
        task.weight,
        task.estimatedTime,
        task.progress,
        task.result ? JSON.stringify(task.result) : null,
        task.performanceWarning ? JSON.stringify(task.performanceWarning) : null
      );

      // Insert task logs
      if (task.logs && task.logs.length > 0) {
        const logStmt = db.prepare(`
          INSERT INTO task_logs (run_id, task_run_id, log_entry)
          VALUES (?, ?, ?)
        `);

        for (const log of task.logs) {
          logStmt.run(run.id, task.id, log);
        }
      }
    }

    // Insert flow-level logs
    if (run.logs && run.logs.length > 0) {
      const logStmt = db.prepare(`
        INSERT INTO logs (run_id, log_entry)
        VALUES (?, ?)
      `);

      for (const log of run.logs) {
        logStmt.run(run.id, log);
      }
    }
  },

  // Get all flow runs
  getAllRuns(): FlowRun[] {
    const runs = db.prepare('SELECT * FROM flow_runs ORDER BY start_time DESC').all() as any[];

    return runs.map(run => {
      const tasks = db.prepare('SELECT * FROM task_runs WHERE run_id = ? ORDER BY rowid').all(run.id) as any[];
      const logs = db.prepare('SELECT log_entry FROM logs WHERE run_id = ? ORDER BY created_at').all(run.id) as any[];

      return {
        id: run.id,
        flowId: run.flow_id,
        flowName: run.flow_name,
        state: run.state,
        startTime: run.start_time,
        endTime: run.end_time,
        configuration: run.configuration,
        tags: run.tags ? JSON.parse(run.tags) : {},
        progress: run.progress,
        clientColor: run.client_color,
        reportPath: run.report_path,
        logs: logs.map(l => l.log_entry),
        tasks: tasks.map(task => {
          const taskLogs = db.prepare(
            'SELECT log_entry FROM task_logs WHERE task_run_id = ? ORDER BY created_at'
          ).all(task.id) as any[];

          return {
            id: task.id,
            taskId: task.task_id,
            taskName: task.task_name,
            state: task.state,
            startTime: task.start_time,
            endTime: task.end_time,
            durationMs: task.duration_ms,
            weight: task.weight,
            estimatedTime: task.estimated_time,
            progress: task.progress,
            result: task.result ? JSON.parse(task.result) : undefined,
            performanceWarning: task.performance_warning ? JSON.parse(task.performance_warning) : undefined,
            logs: taskLogs.map(l => l.log_entry)
          };
        })
      };
    });
  },

  // Get a specific run by ID
  getRunById(runId: string): FlowRun | undefined {
    const run = db.prepare('SELECT * FROM flow_runs WHERE id = ?').get(runId) as any;

    if (!run) return undefined;

    const tasks = db.prepare('SELECT * FROM task_runs WHERE run_id = ? ORDER BY rowid').all(runId) as any[];
    const logs = db.prepare('SELECT log_entry FROM logs WHERE run_id = ? ORDER BY created_at').all(runId) as any[];

    return {
      id: run.id,
      flowId: run.flow_id,
      flowName: run.flow_name,
      state: run.state,
      startTime: run.start_time,
      endTime: run.end_time,
      configuration: run.configuration,
      tags: run.tags ? JSON.parse(run.tags) : {},
      progress: run.progress,
      clientColor: run.client_color,
      reportPath: run.report_path,
      logs: logs.map(l => l.log_entry),
      tasks: tasks.map(task => {
        const taskLogs = db.prepare(
          'SELECT log_entry FROM task_logs WHERE task_run_id = ? ORDER BY created_at'
        ).all(task.id) as any[];

        return {
          id: task.id,
          taskId: task.task_id,
          taskName: task.task_name,
          state: task.state,
          startTime: task.start_time,
          endTime: task.end_time,
          durationMs: task.duration_ms,
          weight: task.weight,
          estimatedTime: task.estimated_time,
          progress: task.progress,
          result: task.result ? JSON.parse(task.result) : undefined,
          performanceWarning: task.performance_warning ? JSON.parse(task.performance_warning) : undefined,
          logs: taskLogs.map(l => l.log_entry)
        };
      })
    };
  },

  // Delete a run
  deleteRun(runId: string) {
    db.prepare('DELETE FROM flow_runs WHERE id = ?').run(runId);
  },

  // Delete all runs for a specific flow
  deleteRunsByFlowId(flowId: string) {
    db.prepare('DELETE FROM flow_runs WHERE flow_id = ?').run(flowId);
  }
};

// Task statistics operations
export const statsDb = {
  // Update statistics for a task (using Welford's online algorithm for variance)
  updateTaskStats(flowName: string, taskName: string, durationMs: number) {
    const existing = db.prepare(
      'SELECT avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ? AND task_name = ?'
    ).get(flowName, taskName) as any;

    if (existing) {
      // Welford's online algorithm for variance
      const newCount = existing.sample_count + 1;
      const delta = durationMs - existing.avg_duration_ms;
      const newAvg = existing.avg_duration_ms + delta / newCount;
      const delta2 = durationMs - newAvg;
      const newM2 = existing.m2 + delta * delta2;

      db.prepare(`
        UPDATE task_statistics
        SET avg_duration_ms = ?, sample_count = ?, m2 = ?, last_updated = ?
        WHERE flow_name = ? AND task_name = ?
      `).run(newAvg, newCount, newM2, new Date().toISOString(), flowName, taskName);
    } else {
      // First sample for this task (m2 starts at 0)
      db.prepare(`
        INSERT INTO task_statistics (flow_name, task_name, avg_duration_ms, sample_count, m2, last_updated)
        VALUES (?, ?, ?, 1, 0, ?)
      `).run(flowName, taskName, durationMs, new Date().toISOString());
    }
  },

  // Get statistics for a specific task in a flow
  getTaskStats(flowName: string, taskName: string): { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number } | undefined {
    const row = db.prepare(
      'SELECT avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ? AND task_name = ?'
    ).get(flowName, taskName) as any;

    if (!row) return undefined;

    // Calculate standard deviation from M2 using sample variance (n-1)
    const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
    const stdDev = Math.sqrt(variance);

    return {
      avgDurationMs: row.avg_duration_ms,
      stdDevDurationMs: stdDev,
      sampleCount: row.sample_count
    };
  },

  // Get all statistics for a flow
  getFlowStats(flowName: string): Map<string, { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number }> {
    const rows = db.prepare(
      'SELECT task_name, avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ?'
    ).all(flowName) as any[];

    const statsMap = new Map<string, { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number }>();
    rows.forEach(row => {
      const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
      const stdDev = Math.sqrt(variance);

      statsMap.set(row.task_name, {
        avgDurationMs: row.avg_duration_ms,
        stdDevDurationMs: stdDev,
        sampleCount: row.sample_count
      });
    });

    return statsMap;
  },

  // Get all statistics (for UI display)
  getAllStats(): Array<{
    flowName: string;
    taskName: string;
    avgDurationMs: number;
    stdDevDurationMs: number;
    sampleCount: number;
    lastUpdated: string;
  }> {
    const rows = db.prepare(
      'SELECT flow_name, task_name, avg_duration_ms, sample_count, m2, last_updated FROM task_statistics ORDER BY flow_name, task_name'
    ).all() as any[];

    return rows.map(row => {
      const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
      const stdDev = Math.sqrt(variance);

      return {
        flowName: row.flow_name,
        taskName: row.task_name,
        avgDurationMs: row.avg_duration_ms,
        stdDevDurationMs: stdDev,
        sampleCount: row.sample_count,
        lastUpdated: row.last_updated
      };
    });
  },

  // Update statistics for a flow (using Welford's online algorithm for variance)
  updateFlowStats(flowName: string, durationMs: number) {
    const existing = db.prepare(
      'SELECT avg_duration_ms, sample_count, m2 FROM flow_statistics WHERE flow_name = ?'
    ).get(flowName) as any;

    if (existing) {
      // Welford's online algorithm
      const newCount = existing.sample_count + 1;
      const delta = durationMs - existing.avg_duration_ms;
      const newAvg = existing.avg_duration_ms + delta / newCount;
      const delta2 = durationMs - newAvg;
      const newM2 = existing.m2 + delta * delta2;

      db.prepare(`
        UPDATE flow_statistics
        SET avg_duration_ms = ?, sample_count = ?, m2 = ?, last_updated = ?
        WHERE flow_name = ?
      `).run(newAvg, newCount, newM2, new Date().toISOString(), flowName);
    } else {
      // First sample for this flow (m2 starts at 0)
      db.prepare(`
        INSERT INTO flow_statistics (flow_name, avg_duration_ms, sample_count, m2, last_updated)
        VALUES (?, ?, 1, 0, ?)
      `).run(flowName, durationMs, new Date().toISOString());
    }
  },

  // Get statistics for a specific flow
  getFlowStatsForFlow(flowName: string): { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number } | undefined {
    const row = db.prepare(
      'SELECT avg_duration_ms, sample_count, m2 FROM flow_statistics WHERE flow_name = ?'
    ).get(flowName) as any;

    if (!row) return undefined;

    // Calculate standard deviation from M2 using sample variance (n-1)
    const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
    const stdDev = Math.sqrt(variance);

    return {
      avgDurationMs: row.avg_duration_ms,
      stdDevDurationMs: stdDev,
      sampleCount: row.sample_count
    };
  },

  // Get all flow statistics (for UI display)
  getAllFlowStats(): Array<{
    flowName: string;
    avgDurationMs: number;
    stdDevDurationMs: number;
    sampleCount: number;
    lastUpdated: string;
  }> {
    const rows = db.prepare(
      'SELECT flow_name, avg_duration_ms, sample_count, m2, last_updated FROM flow_statistics ORDER BY flow_name'
    ).all() as any[];

    return rows.map(row => {
      const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
      const stdDev = Math.sqrt(variance);

      return {
        flowName: row.flow_name,
        avgDurationMs: row.avg_duration_ms,
        stdDevDurationMs: stdDev,
        sampleCount: row.sample_count,
        lastUpdated: row.last_updated
      };
    });
  },

  // Get historical task run data for charting
  getTaskHistory(flowName: string, taskName: string, limit: number = 100): Array<{
    runId: string;
    timestamp: string;
    durationMs: number;
  }> {
    const rows = db.prepare(`
      SELECT
        tr.run_id,
        tr.end_time as timestamp,
        tr.duration_ms
      FROM task_runs tr
      JOIN flow_runs fr ON tr.run_id = fr.id
      WHERE fr.flow_name = ?
        AND tr.task_name = ?
        AND tr.duration_ms IS NOT NULL
        AND tr.state = 'COMPLETED'
      ORDER BY tr.end_time DESC
      LIMIT ?
    `).all(flowName, taskName, limit) as any[];

    return rows.reverse().map(row => ({
      runId: row.run_id,
      timestamp: row.timestamp,
      durationMs: row.duration_ms
    }));
  },

  // Get historical flow run data for charting
  getFlowHistory(flowName: string, limit: number = 100): Array<{
    runId: string;
    timestamp: string;
    durationMs: number;
  }> {
    const rows = db.prepare(`
      SELECT
        id as run_id,
        end_time as timestamp,
        CAST((julianday(end_time) - julianday(start_time)) * 86400000 AS INTEGER) as duration_ms
      FROM flow_runs
      WHERE flow_name = ?
        AND end_time IS NOT NULL
        AND state = 'COMPLETED'
      ORDER BY end_time DESC
      LIMIT ?
    `).all(flowName, limit) as any[];

    return rows.reverse().map(row => ({
      runId: row.run_id,
      timestamp: row.timestamp,
      durationMs: row.duration_ms
    }));
  },

  // Save learned task structure from a completed flow run
  saveFlowTaskStructure(flowName: string, tasks: Array<{ taskName: string; estimatedTime: number }>) {
    const timestamp = new Date().toISOString();

    // Delete existing structure for this flow
    db.prepare('DELETE FROM flow_task_structure WHERE flow_name = ?').run(flowName);

    // Insert new structure
    const stmt = db.prepare(`
      INSERT INTO flow_task_structure (flow_name, task_index, task_name, estimated_time, last_updated)
      VALUES (?, ?, ?, ?, ?)
    `);

    tasks.forEach((task, index) => {
      stmt.run(flowName, index, task.taskName, task.estimatedTime, timestamp);
    });

    console.log(`[Database] Saved task structure for ${flowName}: ${tasks.length} tasks`);
  },

  // Get learned task structure for a flow
  getFlowTaskStructure(flowName: string): Array<{ taskName: string; estimatedTime: number }> | null {
    const rows = db.prepare(`
      SELECT task_name, estimated_time
      FROM flow_task_structure
      WHERE flow_name = ?
      ORDER BY task_index ASC
    `).all(flowName) as any[];

    if (rows.length === 0) {
      return null;
    }

    return rows.map(row => ({
      taskName: row.task_name,
      estimatedTime: row.estimated_time
    }));
  }
};

export default db;
