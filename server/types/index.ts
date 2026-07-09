export * from '../../shared/types';

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
