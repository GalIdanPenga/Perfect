// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TimeSeriesChart } from './TimeSeriesChart';

function makePoint(durationMs: number, offset = 0) {
  return {
    runId: `run-${offset}`,
    timestamp: new Date(1700000000000 + offset * 60000).toISOString(),
    durationMs,
  };
}

describe('TimeSeriesChart', () => {
  it('renders empty state when data is empty', () => {
    render(<TimeSeriesChart data={[]} avgDuration={0} stdDev={0} title="T" />);
    expect(screen.getByText('No historical data available')).toBeTruthy();
  });

  it('renders title', () => {
    render(<TimeSeriesChart data={[makePoint(1000)]} avgDuration={1000} stdDev={0} title="My Chart" />);
    expect(screen.getByText('My Chart')).toBeTruthy();
  });

  it('renders an SVG with data points', () => {
    const { container } = render(
      <TimeSeriesChart
        data={[makePoint(1000), makePoint(1200, 1)]}
        avgDuration={1100}
        stdDev={100}
        title="T"
      />
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renders one circle per data point', () => {
    const { container } = render(
      <TimeSeriesChart
        data={[makePoint(1000), makePoint(1200, 1), makePoint(800, 2)]}
        avgDuration={1000}
        stdDev={0}
        title="T"
      />
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('renders polyline connecting data points when more than one', () => {
    const { container } = render(
      <TimeSeriesChart
        data={[makePoint(1000), makePoint(1200, 1)]}
        avgDuration={1100}
        stdDev={0}
        title="T"
      />
    );
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('renders stdDev band rect when stdDev > 0', () => {
    const { container } = render(
      <TimeSeriesChart
        data={[makePoint(1000)]}
        avgDuration={1000}
        stdDev={200}
        title="T"
      />
    );
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);
  });

  it('renders Avg label on the chart', () => {
    render(
      <TimeSeriesChart
        data={[makePoint(1000)]}
        avgDuration={1000}
        stdDev={0}
        title="T"
      />
    );
    expect(screen.getByText('Avg')).toBeTruthy();
  });

  it('renders legend with avg duration formatted', () => {
    render(
      <TimeSeriesChart
        data={[makePoint(1000)]}
        avgDuration={1500}
        stdDev={0}
        title="T"
      />
    );
    expect(screen.getByText(/1\.50s/)).toBeTruthy();
  });

  it('shows sample count in legend', () => {
    render(
      <TimeSeriesChart
        data={[makePoint(1000), makePoint(2000, 1)]}
        avgDuration={1500}
        stdDev={0}
        title="T"
      />
    );
    expect(screen.getByText(/n=2/)).toBeTruthy();
  });

  it('tooltip title on circle contains Duration and Time', () => {
    const { container } = render(
      <TimeSeriesChart
        data={[makePoint(2500)]}
        avgDuration={2500}
        stdDev={0}
        title="T"
      />
    );
    const titles = container.querySelectorAll('title');
    const titleText = Array.from(titles).map(t => t.textContent).join('');
    expect(titleText).toContain('Duration');
    expect(titleText).toContain('Time');
  });

  it('limits x-axis labels to at most 11 items', () => {
    const manyPoints = Array.from({ length: 20 }, (_, i) => makePoint(1000 + i * 10, i));
    const { container } = render(
      <TimeSeriesChart data={manyPoints} avgDuration={1100} stdDev={0} title="T" />
    );
    const xLabels = Array.from(container.querySelectorAll('text')).filter(t =>
      t.textContent?.startsWith('#')
    );
    expect(xLabels.length).toBeLessThanOrEqual(11);
  });
});
