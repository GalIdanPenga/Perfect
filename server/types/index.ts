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
  weight: number;
  estimatedTime: number;
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
  durationMs?: number;
  logs: string[];
  weight: number;
  estimatedTime: number;
  progress: number;
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
}

export interface FlowRegistrationPayload {
  name: string;
  description: string;
  tags?: Record<string, string>;
  tasks: {
    name: string;
    description?: string;
    weight?: number;
    estimatedTime?: number;
  }[];
}
