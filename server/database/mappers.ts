import { FlowDefinition, FlowRun, TaskDefinition, TaskRun } from '../types';
import { Db } from './schema';

// Row → domain-object mappers. Extracted so the getAll*/get*ById pairs share a
// single mapping definition instead of duplicating it.

function mapTaskDefinitionRow(task: any): TaskDefinition {
  return {
    id: task.id,
    name: task.name,
    description: task.description,
    weight: task.weight,
    estimatedTime: task.estimated_time,
    crucialPass: task.crucial_pass === 1,
  };
}

export function mapFlowRow(db: Db, flow: any): FlowDefinition {
  const tasks = db.prepare('SELECT * FROM tasks WHERE flow_id = ? ORDER BY rowid').all(flow.id) as any[];
  return {
    id: flow.id,
    name: flow.name,
    description: flow.description,
    codeSnippet: flow.code_snippet,
    tags: flow.tags ? JSON.parse(flow.tags) : {},
    createdAt: flow.created_at,
    tasks: tasks.map(mapTaskDefinitionRow),
  };
}

function mapTaskRunRow(db: Db, task: any): TaskRun {
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
    // Null (legacy rows written before crucial_pass existed) defaults to crucial (true)
    crucialPass: task.crucial_pass === null ? true : task.crucial_pass === 1,
    logs: taskLogs.map((l: any) => l.log_entry),
  };
}

export function mapRunRow(db: Db, run: any): FlowRun {
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
    clientName: run.client_name ?? undefined,
    reportPath: run.report_path,
    logs: logs.map((l: any) => l.log_entry),
    tasks: tasks.map((task: any) => mapTaskRunRow(db, task)),
  };
}
