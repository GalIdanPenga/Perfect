// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkerSelector } from './WorkerSelector';
import { WorkerConfig } from '../types';

const makeWorker = (overrides: Partial<WorkerConfig> = {}): WorkerConfig => ({
  id: 'c1',
  name: 'Example Worker',
  description: 'Runs example flows',
  workingDir: 'examples',
  command: 'python',
  args: ['flows.py'],
  color: '#00D9FF',
  ...overrides,
});

const defaultProps = {
  availableWorkers: [makeWorker()],
  selectedWorkerId: 'c1',
  workerStatus: 'stopped' as const,
  themeColor: '#00D9FF',
  isStartingWorker: false,
  onWorkerClick: vi.fn(),
  onStart: vi.fn(),
  onStop: vi.fn(),
};

describe('WorkerSelector', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders all available workers', () => {
    render(<WorkerSelector {...defaultProps} availableWorkers={[
      makeWorker({ id: 'c1', name: 'Worker A' }),
      makeWorker({ id: 'c2', name: 'Worker B' }),
    ]} />);
    expect(screen.getByText('Worker A')).toBeTruthy();
    expect(screen.getByText('Worker B')).toBeTruthy();
  });

  it('calls onWorkerClick when a worker card is clicked', () => {
    const onWorkerClick = vi.fn();
    render(<WorkerSelector {...defaultProps} onWorkerClick={onWorkerClick} />);
    fireEvent.click(screen.getByText('Example Worker'));
    expect(onWorkerClick).toHaveBeenCalledWith('c1');
  });

  it('disables worker cards when workerStatus is running', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="running" />);
    const btn = screen.getByRole('button', { name: /Example Worker/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables worker cards when workerStatus is starting', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="starting" />);
    const btn = screen.getByRole('button', { name: /Example Worker/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Start button when workerStatus is stopped', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="stopped" />);
    expect(screen.getByText('Start Worker')).toBeTruthy();
  });

  it('shows Start button when workerStatus is error', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="error" />);
    expect(screen.getByText('Start Worker')).toBeTruthy();
  });

  it('calls onStart when Start button is clicked', () => {
    const onStart = vi.fn();
    render(<WorkerSelector {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByText('Start Worker'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows Starting... when isStartingWorker=true', () => {
    render(<WorkerSelector {...defaultProps} isStartingWorker />);
    expect(screen.getByText('Starting...')).toBeTruthy();
  });

  it('disables start button while isStartingWorker', () => {
    render(<WorkerSelector {...defaultProps} isStartingWorker />);
    const btn = screen.getByText('Starting...').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows Stop button when workerStatus is running', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="running" />);
    expect(screen.getByText('Stop Worker')).toBeTruthy();
  });

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn();
    render(<WorkerSelector {...defaultProps} workerStatus="running" onStop={onStop} />);
    fireEvent.click(screen.getByText('Stop Worker'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('shows running status message when workerStatus is running', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="running" />);
    expect(screen.getByText(/Worker is connected/)).toBeTruthy();
  });

  it('shows default status message when stopped', () => {
    render(<WorkerSelector {...defaultProps} workerStatus="stopped" />);
    expect(screen.getByText(/Once started/)).toBeTruthy();
  });

  it('renders empty state gracefully when no workers', () => {
    render(<WorkerSelector {...defaultProps} availableWorkers={[]} />);
    expect(screen.queryByText('Select Worker Configuration')).toBeNull();
    expect(screen.getByText('Start Worker')).toBeTruthy();
  });

  it('applies worker color to selected card border', () => {
    const { container } = render(<WorkerSelector {...defaultProps} />);
    const card = container.querySelector('button[style*="00D9FF"]');
    expect(card).toBeTruthy();
  });
});
