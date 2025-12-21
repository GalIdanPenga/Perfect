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
  weight: number;  // Calculated from estimated times during registration
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
  progress: number;
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
  configuration: string;
  tags?: Record<string, string>;
  logs: string[];
  tasks: TaskRun[];
  progress: number;
  clientColor?: string;
  clientName?: string;
  reportPath?: string;
}

export interface FlowRegistrationPayload {
  name: string;
  description: string;
  tags?: Record<string, string>;
  tasks: {
    name: string;
    description?: string;
    estimatedTime?: number;
    crucialPass?: boolean;
  }[];
}
