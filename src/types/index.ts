export * from '../../shared/types';

// Client-only types (not shared with the backend).

export type PerformanceSensitivity = 'conservative' | 'normal' | 'aggressive';

export interface ClientConfig {
  id: string;
  name: string;
  description: string;
  workingDir: string;
  command: string;
  args: string[];
  color?: string;
  performanceSensitivity?: PerformanceSensitivity;
  /** Minimum ms over average before a task can be flagged slow. Defaults to 1000. */
  performanceMinOverageMs?: number;
}
