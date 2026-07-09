import { FlowRun } from '../types';
import { Db } from './schema';
import { mapRunRow } from './mappers';

export function createRunDb(db: Db) {
  return {
    saveRun(run: FlowRun) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO flow_runs
        (id, flow_id, flow_name, state, start_time, end_time, configuration, tags, progress, client_color, report_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        run.id, run.flowId, run.flowName, run.state, run.startTime,
        run.endTime || null, run.configuration, JSON.stringify(run.tags || {}),
        run.progress, run.clientColor || null, run.reportPath || null
      );

      db.prepare('DELETE FROM task_runs WHERE run_id = ?').run(run.id);
      db.prepare('DELETE FROM logs WHERE run_id = ?').run(run.id);
      db.prepare('DELETE FROM task_logs WHERE run_id = ?').run(run.id);

      const taskStmt = db.prepare(`
        INSERT INTO task_runs
        (id, run_id, task_id, task_name, state, start_time, end_time, duration_ms, weight, estimated_time, progress, result, performance_warning, crucial_pass)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const task of run.tasks) {
        taskStmt.run(
          task.id, run.id, task.taskId, task.taskName, task.state,
          task.startTime || null, task.endTime || null, task.durationMs || null,
          task.weight, task.estimatedTime, task.progress,
          task.result ? JSON.stringify(task.result) : null,
          task.performanceWarning ? JSON.stringify(task.performanceWarning) : null,
          task.crucialPass !== undefined ? (task.crucialPass ? 1 : 0) : null
        );

        if (task.logs && task.logs.length > 0) {
          const logStmt = db.prepare(`INSERT INTO task_logs (run_id, task_run_id, log_entry) VALUES (?, ?, ?)`);
          for (const log of task.logs) {
            logStmt.run(run.id, task.id, log);
          }
        }
      }

      if (run.logs && run.logs.length > 0) {
        const logStmt = db.prepare(`INSERT INTO logs (run_id, log_entry) VALUES (?, ?)`);
        for (const log of run.logs) {
          logStmt.run(run.id, log);
        }
      }
    },

    getAllRuns(): FlowRun[] {
      const runs = db.prepare('SELECT * FROM flow_runs ORDER BY start_time DESC').all() as any[];
      return runs.map(run => mapRunRow(db, run));
    },

    getRunById(runId: string): FlowRun | undefined {
      const run = db.prepare('SELECT * FROM flow_runs WHERE id = ?').get(runId) as any;
      if (!run) return undefined;
      return mapRunRow(db, run);
    },

    deleteRun(runId: string) {
      db.prepare('DELETE FROM flow_runs WHERE id = ?').run(runId);
    },

    deleteRunsByFlowId(flowId: string) {
      db.prepare('DELETE FROM flow_runs WHERE flow_id = ?').run(flowId);
    }
  };
}
