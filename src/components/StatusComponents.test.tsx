// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskState } from '../types';
import { StatusIcon, StatusBadge, PerformanceWarningBadge } from './StatusComponents';

describe('StatusIcon', () => {
  it('renders PENDING as a small circle div', () => {
    const { container } = render(<StatusIcon state={TaskState.PENDING} />);
    expect(container.querySelector('div')).toBeTruthy();
  });

  it('renders RUNNING with animate-spin', () => {
    const { container } = render(<StatusIcon state={TaskState.RUNNING} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('renders COMPLETED with CheckCircle SVG', () => {
    const { container } = render(<StatusIcon state={TaskState.COMPLETED} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders FAILED with XCircle SVG', () => {
    const { container } = render(<StatusIcon state={TaskState.FAILED} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders RETRYING with animate-spin', () => {
    const { container } = render(<StatusIcon state={TaskState.RETRYING} />);
    expect(container.querySelector('.animate-spin')).toBeTruthy();
  });

  it('respects custom size prop', () => {
    const { container } = render(<StatusIcon state={TaskState.RUNNING} size={24} />);
    const svg = container.querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('24');
  });
});

describe('StatusBadge', () => {
  it('renders RUNNING with pulsing dot and label', () => {
    render(<StatusBadge state={TaskState.RUNNING} />);
    expect(screen.getByText('RUNNING')).toBeTruthy();
    const dot = document.querySelector('.animate-pulse');
    expect(dot).toBeTruthy();
  });

  it('renders COMPLETED with correct text', () => {
    render(<StatusBadge state={TaskState.COMPLETED} />);
    expect(screen.getByText('COMPLETED')).toBeTruthy();
  });

  it('renders FAILED with correct text', () => {
    render(<StatusBadge state={TaskState.FAILED} />);
    expect(screen.getByText('FAILED')).toBeTruthy();
  });

  it('renders PENDING with correct text', () => {
    render(<StatusBadge state={TaskState.PENDING} />);
    expect(screen.getByText('PENDING')).toBeTruthy();
  });

  it('renders RETRYING with correct text', () => {
    render(<StatusBadge state={TaskState.RETRYING} />);
    expect(screen.getByText('RETRYING')).toBeTruthy();
  });
});

describe('PerformanceWarningBadge', () => {
  it('severity=warning shows SLOW label', () => {
    render(<PerformanceWarningBadge severity="warning" />);
    expect(screen.getByText('SLOW')).toBeTruthy();
  });

  it('severity=critical shows CRITICAL label', () => {
    render(<PerformanceWarningBadge severity="critical" />);
    expect(screen.getByText('CRITICAL')).toBeTruthy();
  });

  it('severity=warning uses amber classes', () => {
    const { container } = render(<PerformanceWarningBadge severity="warning" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('amber');
  });

  it('severity=critical uses red classes', () => {
    const { container } = render(<PerformanceWarningBadge severity="critical" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('red');
  });

  it('isRunning=true adds animate-pulse', () => {
    const { container } = render(<PerformanceWarningBadge severity="warning" isRunning={true} />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).toContain('animate-pulse');
  });

  it('isRunning=false (default) has no animate-pulse', () => {
    const { container } = render(<PerformanceWarningBadge severity="warning" />);
    const badge = container.firstChild as HTMLElement;
    expect(badge.className).not.toContain('animate-pulse');
  });

  it('size=md uses larger icon than size=sm', () => {
    const { container: smContainer } = render(<PerformanceWarningBadge severity="warning" size="sm" />);
    const { container: mdContainer } = render(<PerformanceWarningBadge severity="warning" size="md" />);
    const smSvg = smContainer.querySelector('svg');
    const mdSvg = mdContainer.querySelector('svg');
    expect(smSvg?.className).toContain('w-3');
    expect(mdSvg?.className).toContain('w-4');
  });
});
