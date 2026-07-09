// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppHeader } from './AppHeader';
import { ClientConfig } from '../types';

const client: ClientConfig = {
  id: 'c1',
  name: 'My Client',
  description: '',
  workingDir: '.',
  command: 'python',
  args: [],
  color: '#0ea5e9',
};

describe('AppHeader', () => {
  it('renders the title and version', () => {
    render(<AppHeader themeColor="#0ea5e9" activeClient={null} />);
    expect(screen.getByText('Perfect')).toBeTruthy();
    expect(screen.getByText('v2.0')).toBeTruthy();
  });

  it('shows "System Online" when no client is active', () => {
    render(<AppHeader themeColor="#0ea5e9" activeClient={null} />);
    expect(screen.getByText('System Online')).toBeTruthy();
    expect(screen.queryByText('Client Active')).toBeNull();
  });

  it('shows "Client Active" when a client is active', () => {
    render(<AppHeader themeColor="#0ea5e9" activeClient={client} />);
    expect(screen.getByText('Client Active')).toBeTruthy();
    expect(screen.queryByText('System Online')).toBeNull();
  });
});
