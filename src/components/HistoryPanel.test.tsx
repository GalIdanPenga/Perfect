// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HistoryPanel } from './HistoryPanel';
import { FlowRun, TaskState } from '../types';

const makeRun = (overrides: Partial<FlowRun> = {}): FlowRun => ({
  id: `run-${Math.random().toString(36).slice(2, 7)}`,
  flowId: 'flow-1',
  flowName: 'My Flow',
  state: TaskState.COMPLETED,
  startTime: new Date().toISOString(),
  configuration: 'test',
  tags: {},
  logs: [],
  tasks: [],
  progress: 100,
  ...overrides,
});

const noop = vi.fn().mockResolvedValue(undefined);

describe('HistoryPanel', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders nothing when runs array is empty', () => {
    const { container } = render(
      <HistoryPanel runs={[]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders "Execution History" heading when runs exist', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    expect(screen.getByText('Execution History')).toBeTruthy();
  });

  it('shows each run flow name', () => {
    render(<HistoryPanel runs={[
      makeRun({ flowName: 'Flow A' }),
      makeRun({ flowName: 'Flow B' }),
    ]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    // Flow names appear in both run rows AND flowNameFilter dropdown options
    expect(screen.getAllByText('Flow A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Flow B').length).toBeGreaterThan(0);
  });

  it('shows count badge with filtered run count', () => {
    render(<HistoryPanel runs={[makeRun(), makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('filters by status — shows only FAILED runs when FAILED selected', () => {
    const { container } = render(<HistoryPanel runs={[
      makeRun({ id: 'r1', flowName: 'Completed Run', state: TaskState.COMPLETED }),
      makeRun({ id: 'r2', flowName: 'Failed Run', state: TaskState.FAILED }),
    ]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    const select = screen.getAllByRole('combobox')[0];
    // Before filter: 2 run rows (2 delete buttons)
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(2);
    fireEvent.change(select, { target: { value: TaskState.FAILED } });
    // After filter: only 1 run row
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(1);
  });

  it('shows "No matching runs found" when filter excludes all runs', () => {
    render(<HistoryPanel runs={[makeRun({ state: TaskState.COMPLETED })]}
      themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: TaskState.FAILED } });
    expect(screen.getByText('No matching runs found')).toBeTruthy();
  });

  it('shows Clear Filters button when a filter is active', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: TaskState.FAILED } });
    expect(screen.getByText('Clear Filters')).toBeTruthy();
  });

  it('clicking Clear Filters resets to show all runs', () => {
    const { container } = render(<HistoryPanel runs={[makeRun({ state: TaskState.COMPLETED })]}
      themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    const select = screen.getAllByRole('combobox')[0];
    fireEvent.change(select, { target: { value: TaskState.FAILED } });
    // Filter hides the run
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(0);
    fireEvent.click(screen.getByText('Clear Filters'));
    // Run visible again
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(1);
  });

  it('filters by search query', () => {
    const { container } = render(<HistoryPanel runs={[
      makeRun({ flowName: 'Alpha Pipeline' }),
      makeRun({ flowName: 'Beta Pipeline' }),
    ]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    const input = screen.getByPlaceholderText(/Search/i);
    // Before filter: 2 run rows
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(2);
    fireEvent.change(input, { target: { value: 'Alpha' } });
    // After filter: only 1 run row
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(1);
  });

  it('shows Select All button', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    expect(screen.getByText('Select All')).toBeTruthy();
  });

  it('clicking Select All shows Deselect All and delete button', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    fireEvent.click(screen.getByText('Select All'));
    expect(screen.getByText('Deselect All')).toBeTruthy();
    expect(screen.getByText(/Delete \(1\)/)).toBeTruthy();
  });

  it('clicking Deselect All hides delete button', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText('Deselect All'));
    expect(screen.queryByText(/Delete \(/)).toBeNull();
  });

  it('clicking bulk Delete opens confirm dialog', () => {
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText(/Delete \(1\)/));
    expect(screen.getByText('Delete Runs')).toBeTruthy();
  });

  it('confirming bulk delete calls onBulkDelete', async () => {
    const onBulkDelete = vi.fn().mockResolvedValue(undefined);
    const run = makeRun({ id: 'run-abc' });
    render(<HistoryPanel runs={[run]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={onBulkDelete} />);
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText(/Delete \(1\)/));
    fireEvent.click(screen.getByText('Delete All'));
    await vi.waitFor(() => expect(onBulkDelete).toHaveBeenCalledWith(['run-abc']));
  });

  it('cancelling bulk delete dialog hides it without calling onBulkDelete', () => {
    const onBulkDelete = vi.fn();
    render(<HistoryPanel runs={[makeRun()]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={onBulkDelete} />);
    fireEvent.click(screen.getByText('Select All'));
    fireEvent.click(screen.getByText(/Delete \(1\)/));
    fireEvent.click(screen.getByText('Cancel'));
    expect(onBulkDelete).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete Runs')).toBeNull();
  });

  it('clicking trash icon on a run opens single delete dialog', () => {
    const { container } = render(
      <HistoryPanel runs={[makeRun({ flowName: 'My Flow' })]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />
    );
    const trashBtn = container.querySelector('button[title="Delete run"]') as HTMLButtonElement;
    fireEvent.click(trashBtn);
    expect(screen.getByText('Delete Run')).toBeTruthy();
  });

  it('confirming single delete calls onDeleteRun with runId', async () => {
    const onDeleteRun = vi.fn().mockResolvedValue(undefined);
    const run = makeRun({ id: 'run-xyz' });
    const { container } = render(
      <HistoryPanel runs={[run]} themeColor="#0ea5e9" onDeleteRun={onDeleteRun} onBulkDelete={noop} />
    );
    const trashBtn = container.querySelector('button[title="Delete run"]') as HTMLButtonElement;
    fireEvent.click(trashBtn);
    fireEvent.click(screen.getByText('Delete'));
    await vi.waitFor(() => expect(onDeleteRun).toHaveBeenCalledWith('run-xyz'));
  });

  it('shows Show All button when more than 10 runs', () => {
    const runs = Array.from({ length: 11 }, (_, i) => makeRun({ id: `r${i}` }));
    render(<HistoryPanel runs={runs} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    expect(screen.getByText(/Show All/)).toBeTruthy();
  });

  it('clicking Show All reveals all runs', () => {
    const runs = Array.from({ length: 12 }, (_, i) => makeRun({ id: `r${i}`, flowName: `Flow ${i}` }));
    const { container } = render(<HistoryPanel runs={runs} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    // Before Show All: only 10 run rows (12 total but sliced to 10)
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(10);
    fireEvent.click(screen.getByText(/Show All/));
    // After Show All: all 12 run rows
    expect(container.querySelectorAll('button[title="Delete run"]').length).toBe(12);
  });

  it('clicking a run row expands its details', () => {
    const { container } = render(<HistoryPanel runs={[makeRun({ flowName: 'My Flow' })]} themeColor="#0ea5e9" onDeleteRun={noop} onBulkDelete={noop} />);
    // The span with title="My Flow" is inside the clickable row div
    fireEvent.click(screen.getByTitle('My Flow'));
    // After click: an expanded section appears (div with ml-4 overflow-hidden)
    expect(container.querySelector('.ml-4.overflow-hidden')).toBeTruthy();
  });
});
