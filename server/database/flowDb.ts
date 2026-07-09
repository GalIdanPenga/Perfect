import { FlowDefinition } from '../types';
import { Db } from './schema';
import { mapFlowRow } from './mappers';

export function createFlowDb(db: Db) {
  return {
    saveFlow(flow: FlowDefinition) {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO flows (id, name, description, code_snippet, tags, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run(flow.id, flow.name, flow.description, flow.codeSnippet, JSON.stringify(flow.tags || {}), flow.createdAt);

      db.prepare('DELETE FROM tasks WHERE flow_id = ?').run(flow.id);

      const taskStmt = db.prepare(`
        INSERT INTO tasks (id, flow_id, name, description, weight, estimated_time, crucial_pass)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const task of flow.tasks) {
        taskStmt.run(task.id, flow.id, task.name, task.description, task.weight, task.estimatedTime, task.crucialPass ? 1 : 0);
      }
    },

    getAllFlows(): FlowDefinition[] {
      const flows = db.prepare('SELECT * FROM flows ORDER BY created_at DESC').all() as any[];
      return flows.map(flow => mapFlowRow(db, flow));
    },

    getFlowById(flowId: string): FlowDefinition | undefined {
      const flow = db.prepare('SELECT * FROM flows WHERE id = ?').get(flowId) as any;
      if (!flow) return undefined;
      return mapFlowRow(db, flow);
    },

    deleteFlow(flowId: string) {
      db.prepare('DELETE FROM flows WHERE id = ?').run(flowId);
    }
  };
}
