// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from './AppHeader';
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

describe('AppHeader', () => {
  it('renders the title and version', () => {
    render(<AppHeader themeColor="#0ea5e9" activeWorker={null} />);
    expect(screen.getByText('Perfect')).toBeTruthy();
    expect(screen.getByText('v2.0')).toBeTruthy();
  });

  it('shows VITE_APP_VERSION from the environment when set', async () => {
    vi.stubEnv('VITE_APP_VERSION', ' v9.9-test ');
    vi.resetModules();
    const { AppHeader: FreshHeader } = await import('./AppHeader');
    render(<FreshHeader themeColor="#0ea5e9" activeWorker={null} />);
    expect(screen.getByText('v9.9-test')).toBeTruthy();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('shows "System Online" when no worker is active', () => {
    render(<AppHeader themeColor="#0ea5e9" activeWorker={null} />);
    expect(screen.getByText('System Online')).toBeTruthy();
    expect(screen.queryByText('Worker Active')).toBeNull();
  });

  it('shows "Worker Active" when a worker is active', () => {
    render(<AppHeader themeColor="#0ea5e9" activeWorker={worker} />);
    expect(screen.getByText('Worker Active')).toBeTruthy();
    expect(screen.queryByText('System Online')).toBeNull();
  });
});
