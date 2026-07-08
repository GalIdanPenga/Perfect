// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientSelector } from './ClientSelector';
import { ClientConfig } from '../types';

const makeClient = (overrides: Partial<ClientConfig> = {}): ClientConfig => ({
  id: 'c1',
  name: 'Example Client',
  description: 'Runs example flows',
  workingDir: 'examples',
  command: 'python',
  args: ['flows.py'],
  color: '#00D9FF',
  ...overrides,
});

const defaultProps = {
  availableClients: [makeClient()],
  selectedClientId: 'c1',
  clientStatus: 'stopped' as const,
  themeColor: '#00D9FF',
  isStartingClient: false,
  onClientClick: vi.fn(),
  onStart: vi.fn(),
  onStop: vi.fn(),
};

describe('ClientSelector', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders all available clients', () => {
    render(<ClientSelector {...defaultProps} availableClients={[
      makeClient({ id: 'c1', name: 'Client A' }),
      makeClient({ id: 'c2', name: 'Client B' }),
    ]} />);
    expect(screen.getByText('Client A')).toBeTruthy();
    expect(screen.getByText('Client B')).toBeTruthy();
  });

  it('calls onClientClick when a client card is clicked', () => {
    const onClientClick = vi.fn();
    render(<ClientSelector {...defaultProps} onClientClick={onClientClick} />);
    fireEvent.click(screen.getByText('Example Client'));
    expect(onClientClick).toHaveBeenCalledWith('c1');
  });

  it('disables client cards when clientStatus is running', () => {
    render(<ClientSelector {...defaultProps} clientStatus="running" />);
    const btn = screen.getByRole('button', { name: /Example Client/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables client cards when clientStatus is starting', () => {
    render(<ClientSelector {...defaultProps} clientStatus="starting" />);
    const btn = screen.getByRole('button', { name: /Example Client/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows Start button when clientStatus is stopped', () => {
    render(<ClientSelector {...defaultProps} clientStatus="stopped" />);
    expect(screen.getByText('Start Python Client')).toBeTruthy();
  });

  it('shows Start button when clientStatus is error', () => {
    render(<ClientSelector {...defaultProps} clientStatus="error" />);
    expect(screen.getByText('Start Python Client')).toBeTruthy();
  });

  it('calls onStart when Start button is clicked', () => {
    const onStart = vi.fn();
    render(<ClientSelector {...defaultProps} onStart={onStart} />);
    fireEvent.click(screen.getByText('Start Python Client'));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('shows Starting... when isStartingClient=true', () => {
    render(<ClientSelector {...defaultProps} isStartingClient />);
    expect(screen.getByText('Starting...')).toBeTruthy();
  });

  it('disables start button while isStartingClient', () => {
    render(<ClientSelector {...defaultProps} isStartingClient />);
    const btn = screen.getByText('Starting...').closest('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows Stop button when clientStatus is running', () => {
    render(<ClientSelector {...defaultProps} clientStatus="running" />);
    expect(screen.getByText('Stop Client')).toBeTruthy();
  });

  it('calls onStop when Stop button is clicked', () => {
    const onStop = vi.fn();
    render(<ClientSelector {...defaultProps} clientStatus="running" onStop={onStop} />);
    fireEvent.click(screen.getByText('Stop Client'));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('shows running status message when clientStatus is running', () => {
    render(<ClientSelector {...defaultProps} clientStatus="running" />);
    expect(screen.getByText(/Client is connected/)).toBeTruthy();
  });

  it('shows default status message when stopped', () => {
    render(<ClientSelector {...defaultProps} clientStatus="stopped" />);
    expect(screen.getByText(/Once started/)).toBeTruthy();
  });

  it('renders empty state gracefully when no clients', () => {
    render(<ClientSelector {...defaultProps} availableClients={[]} />);
    expect(screen.queryByText('Select Client Configuration')).toBeNull();
    expect(screen.getByText('Start Python Client')).toBeTruthy();
  });

  it('applies client color to selected card border', () => {
    const { container } = render(<ClientSelector {...defaultProps} />);
    const card = container.querySelector('button[style*="00D9FF"]');
    expect(card).toBeTruthy();
  });
});
