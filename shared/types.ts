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

export type PerformanceSensitivity = 'conservative' | 'normal' | 'aggressive';

/** One entry of server/clients.json, also served to the UI by /api/client/configs. */
export interface ClientConfig {
  id: string;
  name: string;
  description: string;
  workingDir: string;
  command: string;
  args: string[];
  color?: string;
  performanceSensitivity?: PerformanceSensitivity;
  /**
   * Absolute threshold for slow-task warnings: a task must be at least this
   * many ms slower than its average, on top of the sigma test. Defaults to
   * 1000 (DEFAULT_MIN_OVERAGE_MS on the server).
   */
  performanceMinOverageMs?: number;
  /**
   * Whether the client sends heartbeats so the server can fail its runs if it
   * crashes. Defaults to true. Passed to the process as PERFECT_HEARTBEAT.
   */
  heartbeat?: boolean;
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
