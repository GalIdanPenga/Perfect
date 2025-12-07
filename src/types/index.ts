
export enum TaskState {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING'
}

export interface TaskDefinition {
  id: string;
  name: string;
  description?: string;
  weight?: number; // Relative importance (default 1)
  estimatedTime?: number; // Expected duration in ms
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

export interface TaskRun {
  id: string;
  taskId: string;
  taskName: string;
  state: TaskState;
  startTime?: string;
  endTime?: string;
  logs: string[];
  durationMs?: number;
  weight: number;
  estimatedTime: number;
  progress: number; // 0 to 100 for this specific task
}

export interface FlowRun {
  id: string;
  flowId: string;
  flowName: string;
  state: TaskState;
  startTime: string;
  endTime?: string;
  tasks: TaskRun[];
  progress: number; // 0 to 100 (Weighted average)
  configuration?: string; // 'development' | 'debug' | 'release'
  tags?: Record<string, string>;
  logs: string[]; // Flow-level logs (configuration, startup, etc.)
}

export type ViewMode = 'dashboard' | 'flows' | 'runs' | 'docs';
