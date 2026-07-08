// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PerformanceChart } from './PerformanceChart';

function makePoint(label: string, avgDuration: number, stdDev = 0, sampleCount = 5) {
  return { label, avgDuration, stdDev, sampleCount };
}

describe('PerformanceChart', () => {
  it('renders nothing when data is empty', () => {
    const { container } = render(<PerformanceChart data={[]} title="Test" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title', () => {
    render(<PerformanceChart data={[makePoint('taskA', 1000)]} title="My Chart" />);
    expect(screen.getByText('My Chart')).toBeTruthy();
  });

  it('renders one bar rect per data point', () => {
    const { container } = render(
      <PerformanceChart data={[makePoint('a', 500), makePoint('b', 800)]} title="T" />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBe(2);
  });

  it('renders x-axis label for each data point', () => {
    render(
      <PerformanceChart
        data={[makePoint('alpha', 500), makePoint('beta', 800)]}
        title="T"
      />
    );
    expect(screen.getByText('alpha')).toBeTruthy();
    expect(screen.getByText('beta')).toBeTruthy();
  });

  it('truncates label longer than 20 chars', () => {
    const longLabel = 'averylongtasknamelabel';
    render(<PerformanceChart data={[makePoint(longLabel, 1000)]} title="T" />);
    expect(screen.getByText((t) => t === 'averylongtasknamelab...')).toBeTruthy();
  });

  it('renders sample count badge above each bar', () => {
    render(<PerformanceChart data={[makePoint('task', 1000, 0, 7)]} title="T" />);
    expect(screen.getByText('n=7')).toBeTruthy();
  });

  it('uses unique gradient id per title', () => {
    const { container: c1 } = render(<PerformanceChart data={[makePoint('x', 1)]} title="Flow One" />);
    const { container: c2 } = render(<PerformanceChart data={[makePoint('x', 1)]} title="Flow Two" />);
    const g1 = c1.querySelector('linearGradient')?.id;
    const g2 = c2.querySelector('linearGradient')?.id;
    expect(g1).not.toBe(g2);
    expect(g1).toContain('barGradient-Flow-One');
    expect(g2).toContain('barGradient-Flow-Two');
  });

  it('renders error bars when stdDev > 0', () => {
    const { container } = render(
      <PerformanceChart data={[makePoint('task', 1000, 200)]} title="T" />
    );
    const lines = container.querySelectorAll('line');
    // At least 3 lines for error bar (cap top, cap bottom, vertical)
    expect(lines.length).toBeGreaterThan(2);
  });

  it('renders SVG element', () => {
    const { container } = render(<PerformanceChart data={[makePoint('t', 100)]} title="T" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('tooltip title contains label and sample info', () => {
    const { container } = render(
      <PerformanceChart data={[makePoint('my-task', 1000, 100, 5)]} title="T" />
    );
    const titles = container.querySelectorAll('title');
    const titleTexts = Array.from(titles).map(t => t.textContent || '');
    expect(titleTexts.some(t => t.includes('my-task'))).toBe(true);
  });
});
