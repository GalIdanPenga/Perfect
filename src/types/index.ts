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
  /** Whether the client sends heartbeats so crashes are detected. Defaults to true. */
  heartbeat?: boolean;
}
