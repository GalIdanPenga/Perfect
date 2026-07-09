// Single source of truth for the domain types shared between the frontend
// (src/) and backend (server/). Both `src/types/index.ts` and
// `server/types/index.ts` re-export from here so the two can never drift.

export enum TaskState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

export interface TaskDefinition {
  id: string;
  name: string;
  description: string;
  weight: number; // Calculated from estimated times during registration
  estimatedTime: number;
  crucialPass: boolean;
}

export interface FlowDefinition {
  id: string;
  name: string;
  description: string;
  codeSnippet: string;
  tags?: Record<string, string>;
  tasks: TaskDefinition[];
  createdAt: string;
}

export interface TaskResult {
  passed: boolean;
  note: string;
  table: Record<string, any>[];
}

export interface PerformanceWarning {
  type: 'slow';
  message: string;
  severity: 'warning' | 'critical';
}

export interface TaskRun {
  id: string;
  taskId: string;
  taskName: string;
  state: TaskState;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  logs: string[];
  weight: number;
  estimatedTime: number;
  progress: number; // 0 to 100 for this specific task
  result?: TaskResult;
  performanceWarning?: PerformanceWarning;
  crucialPass: boolean; // If true, task failure fails the entire flow (default: true)
}

export interface FlowRun {
  id: string;
  flowId: string;
  flowName: string;
  state: TaskState;
  startTime: string;
  endTime?: string;
  configuration: string; // 'development' | 'debug' | 'release'
  tags?: Record<string, string>;
  logs: string[]; // Flow-level logs (configuration, startup, etc.)
  tasks: TaskRun[];
  progress: number; // 0 to 100 (Weighted average)
  clientColor?: string;
  clientName?: string;
  reportPath?: string;
}
