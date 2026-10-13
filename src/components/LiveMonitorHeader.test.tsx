// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveMonitorHeader } from './LiveMonitorHeader';
import { WorkerConfig } from '../types';

const worker: WorkerConfig = {
  id: 'c1',
  name: 'My Worker',
  description: '',
  workingDir: '.',
  command: 'python',
  args: [],
  color: '#0ea5e9',
};

const baseProps = {
  themeColor: '#0ea5e9',
  runningFlowsCount: 0,
  activeWorker: null,
  onShowStatistics: vi.fn(),
};

describe('LiveMonitorHeader', () => {
  it('renders the title and Statistics button', () => {
    render(<LiveMonitorHeader {...baseProps} />);
    expect(screen.getByText('Live Monitor')).toBeTruthy();
    expect(screen.getByText('Statistics')).toBeTruthy();
  });

  it('shows the ACTIVE badge only when flows are running', () => {
    const { rerender } = render(<LiveMonitorHeader {...baseProps} runningFlowsCount={0} />);
    expect(screen.queryByText(/ACTIVE/)).toBeNull();
    rerender(<LiveMonitorHeader {...baseProps} runningFlowsCount={3} />);
    expect(screen.getByText(/3 ACTIVE/)).toBeTruthy();
  });

  it('shows the active worker name when present', () => {
    render(<LiveMonitorHeader {...baseProps} activeWorker={worker} />);
    expect(screen.getByText('My Worker')).toBeTruthy();
  });

  it('calls onShowStatistics when the Statistics button is clicked', () => {
    const onShowStatistics = vi.fn();
    render(<LiveMonitorHeader {...baseProps} onShowStatistics={onShowStatistics} />);
    fireEvent.click(screen.getByText('Statistics'));
    expect(onShowStatistics).toHaveBeenCalledTimes(1);
  });
});
