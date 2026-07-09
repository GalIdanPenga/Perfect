import { Db } from './schema';

export function createStatsDb(db: Db) {
  return {
    updateTaskStats(flowName: string, taskName: string, durationMs: number) {
      const existing = db.prepare(
        'SELECT avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ? AND task_name = ?'
      ).get(flowName, taskName) as any;

      if (existing) {
        const newCount = existing.sample_count + 1;
        const delta = durationMs - existing.avg_duration_ms;
        const newAvg = existing.avg_duration_ms + delta / newCount;
        const delta2 = durationMs - newAvg;
        const newM2 = existing.m2 + delta * delta2;
        db.prepare(`
          UPDATE task_statistics SET avg_duration_ms = ?, sample_count = ?, m2 = ?, last_updated = ?
          WHERE flow_name = ? AND task_name = ?
        `).run(newAvg, newCount, newM2, new Date().toISOString(), flowName, taskName);
      } else {
        db.prepare(`
          INSERT INTO task_statistics (flow_name, task_name, avg_duration_ms, sample_count, m2, last_updated)
          VALUES (?, ?, ?, 1, 0, ?)
        `).run(flowName, taskName, durationMs, new Date().toISOString());
      }
    },

    getTaskStats(flowName: string, taskName: string): { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number } | undefined {
      const row = db.prepare(
        'SELECT avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ? AND task_name = ?'
      ).get(flowName, taskName) as any;
      if (!row) return undefined;
      const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
      return {
        avgDurationMs: row.avg_duration_ms,
        stdDevDurationMs: Math.sqrt(variance),
        sampleCount: row.sample_count
      };
    },

    getFlowStats(flowName: string): Map<string, { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number }> {
      const rows = db.prepare(
        'SELECT task_name, avg_duration_ms, sample_count, m2 FROM task_statistics WHERE flow_name = ?'
      ).all(flowName) as any[];
      const statsMap = new Map<string, { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number }>();
      rows.forEach(row => {
        const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
        statsMap.set(row.task_name, {
          avgDurationMs: row.avg_duration_ms,
          stdDevDurationMs: Math.sqrt(variance),
          sampleCount: row.sample_count
        });
      });
      return statsMap;
    },

    getAllStats(): Array<{ flowName: string; taskName: string; avgDurationMs: number; stdDevDurationMs: number; sampleCount: number; lastUpdated: string }> {
      const rows = db.prepare(
        'SELECT flow_name, task_name, avg_duration_ms, sample_count, m2, last_updated FROM task_statistics ORDER BY flow_name, task_name'
      ).all() as any[];
      return rows.map(row => {
        const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
        return {
          flowName: row.flow_name,
          taskName: row.task_name,
          avgDurationMs: row.avg_duration_ms,
          stdDevDurationMs: Math.sqrt(variance),
          sampleCount: row.sample_count,
          lastUpdated: row.last_updated
        };
      });
    },

    updateFlowStats(flowName: string, durationMs: number) {
      const existing = db.prepare(
        'SELECT avg_duration_ms, sample_count, m2 FROM flow_statistics WHERE flow_name = ?'
      ).get(flowName) as any;

      if (existing) {
        const newCount = existing.sample_count + 1;
        const delta = durationMs - existing.avg_duration_ms;
        const newAvg = existing.avg_duration_ms + delta / newCount;
        const delta2 = durationMs - newAvg;
        const newM2 = existing.m2 + delta * delta2;
        db.prepare(`
          UPDATE flow_statistics SET avg_duration_ms = ?, sample_count = ?, m2 = ?, last_updated = ?
          WHERE flow_name = ?
        `).run(newAvg, newCount, newM2, new Date().toISOString(), flowName);
      } else {
        db.prepare(`
          INSERT INTO flow_statistics (flow_name, avg_duration_ms, sample_count, m2, last_updated)
          VALUES (?, ?, 1, 0, ?)
        `).run(flowName, durationMs, new Date().toISOString());
      }
    },

    getFlowStatsForFlow(flowName: string): { avgDurationMs: number; stdDevDurationMs: number; sampleCount: number } | undefined {
      const row = db.prepare(
        'SELECT avg_duration_ms, sample_count, m2 FROM flow_statistics WHERE flow_name = ?'
      ).get(flowName) as any;
      if (!row) return undefined;
      const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
      return {
        avgDurationMs: row.avg_duration_ms,
        stdDevDurationMs: Math.sqrt(variance),
        sampleCount: row.sample_count
      };
    },

    getAllFlowStats(): Array<{ flowName: string; avgDurationMs: number; stdDevDurationMs: number; sampleCount: number; lastUpdated: string }> {
      const rows = db.prepare(
        'SELECT flow_name, avg_duration_ms, sample_count, m2, last_updated FROM flow_statistics ORDER BY flow_name'
      ).all() as any[];
      return rows.map(row => {
        const variance = row.sample_count > 1 ? row.m2 / (row.sample_count - 1) : 0;
        return {
          flowName: row.flow_name,
          avgDurationMs: row.avg_duration_ms,
          stdDevDurationMs: Math.sqrt(variance),
          sampleCount: row.sample_count,
          lastUpdated: row.last_updated
        };
      });
    },

    getTaskHistory(flowName: string, taskName: string, limit: number = 100): Array<{ runId: string; timestamp: string; durationMs: number }> {
      const rows = db.prepare(`
        SELECT tr.run_id, tr.end_time as timestamp, tr.duration_ms
        FROM task_runs tr
        JOIN flow_runs fr ON tr.run_id = fr.id
        WHERE fr.flow_name = ? AND tr.task_name = ? AND tr.duration_ms IS NOT NULL AND tr.state = 'COMPLETED'
        ORDER BY tr.end_time DESC LIMIT ?
      `).all(flowName, taskName, limit) as any[];
      return rows.reverse().map(row => ({ runId: row.run_id, timestamp: row.timestamp, durationMs: row.duration_ms }));
    },

    getFlowHistory(flowName: string, limit: number = 100): Array<{ runId: string; timestamp: string; durationMs: number }> {
      const rows = db.prepare(`
        SELECT id as run_id, end_time as timestamp,
          CAST((julianday(end_time) - julianday(start_time)) * 86400000 AS INTEGER) as duration_ms
        FROM flow_runs
        WHERE flow_name = ? AND end_time IS NOT NULL AND state = 'COMPLETED'
        ORDER BY end_time DESC LIMIT ?
      `).all(flowName, limit) as any[];
      return rows.reverse().map(row => ({ runId: row.run_id, timestamp: row.timestamp, durationMs: row.duration_ms }));
    },

    saveFlowTaskStructure(flowName: string, tasks: Array<{ taskName: string; estimatedTime: number }>) {
      const timestamp = new Date().toISOString();
      db.prepare('DELETE FROM flow_task_structure WHERE flow_name = ?').run(flowName);
      const stmt = db.prepare(`
        INSERT INTO flow_task_structure (flow_name, task_index, task_name, estimated_time, last_updated)
        VALUES (?, ?, ?, ?, ?)
      `);
      tasks.forEach((task, index) => {
        stmt.run(flowName, index, task.taskName, task.estimatedTime, timestamp);
      });
    },

    getFlowTaskStructure(flowName: string): Array<{ taskName: string; estimatedTime: number }> | null {
      const rows = db.prepare(`
        SELECT task_name, estimated_time FROM flow_task_structure
        WHERE flow_name = ? ORDER BY task_index ASC
      `).all(flowName) as any[];
      if (rows.length === 0) return null;
      return rows.map(row => ({ taskName: row.task_name, estimatedTime: row.estimated_time }));
    },

    deleteFlowStats(flowName: string) {
      db.prepare('DELETE FROM task_statistics WHERE flow_name = ?').run(flowName);
      db.prepare('DELETE FROM flow_statistics WHERE flow_name = ?').run(flowName);
      db.prepare('DELETE FROM flow_task_structure WHERE flow_name = ?').run(flowName);
    },

    deleteAllStats() {
      db.prepare('DELETE FROM task_statistics').run();
      db.prepare('DELETE FROM flow_statistics').run();
      db.prepare('DELETE FROM flow_task_structure').run();
    }
  };
}
