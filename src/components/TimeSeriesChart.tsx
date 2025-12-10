import React from 'react';

interface DataPoint {
  runId: string;
  timestamp: string;
  durationMs: number;
}

interface TimeSeriesChartProps {
  data: DataPoint[];
  avgDuration: number;
  stdDev: number;
  title: string;
}

export function TimeSeriesChart({ data, avgDuration, stdDev, title }: TimeSeriesChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-8 text-center">
        <p className="text-slate-400">No historical data available</p>
      </div>
    );
  }

  const chartWidth = 900;
  const chartHeight = 400;
  const padding = { top: 40, right: 20, bottom: 60, left: 70 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // Find min and max for Y-axis scaling
  const allValues = data.map(d => d.durationMs);
  const minValue = Math.min(...allValues, avgDuration - stdDev);
  const maxValue = Math.max(...allValues, avgDuration + stdDev);
  const yRange = maxValue - minValue;
  const yMin = Math.max(0, minValue - yRange * 0.1);
  const yMax = maxValue + yRange * 0.1;
  const yScale = plotHeight / (yMax - yMin);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  // Calculate point positions
  const points = data.map((point, i) => {
    const x = padding.left + (i / (data.length - 1 || 1)) * plotWidth;
    const y = padding.top + plotHeight - (point.durationMs - yMin) * yScale;
    return { x, y, point };
  });

  // Calculate average and stdDev lines
  const avgY = padding.top + plotHeight - (avgDuration - yMin) * yScale;
  const stdDevTopY = padding.top + plotHeight - (avgDuration + stdDev - yMin) * yScale;
  const stdDevBottomY = padding.top + plotHeight - (avgDuration - stdDev - yMin) * yScale;

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto">
        <svg width={chartWidth} height={chartHeight}>
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = padding.top + plotHeight * (1 - fraction);
            const value = yMin + (yMax - yMin) * fraction;
            return (
              <g key={fraction}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + plotWidth}
                  y2={y}
                  stroke="#334155"
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="12"
                >
                  {formatDuration(value)}
                </text>
              </g>
            );
          })}

          {/* Standard deviation band */}
          <rect
            x={padding.left}
            y={Math.max(padding.top, stdDevTopY)}
            width={plotWidth}
            height={Math.min(plotHeight, stdDevBottomY - stdDevTopY)}
            fill="#a78bfa"
            opacity="0.15"
          />

          {/* Standard deviation lines */}
          <line
            x1={padding.left}
            y1={stdDevTopY}
            x2={padding.left + plotWidth}
            y2={stdDevTopY}
            stroke="#a78bfa"
            strokeWidth="2"
            strokeDasharray="6,4"
          />
          <line
            x1={padding.left}
            y1={stdDevBottomY}
            x2={padding.left + plotWidth}
            y2={stdDevBottomY}
            stroke="#a78bfa"
            strokeWidth="2"
            strokeDasharray="6,4"
          />

          {/* Average line */}
          <line
            x1={padding.left}
            y1={avgY}
            x2={padding.left + plotWidth}
            y2={avgY}
            stroke="#38bdf8"
            strokeWidth="3"
          />
          <text
            x={padding.left + plotWidth + 5}
            y={avgY + 4}
            fill="#38bdf8"
            fontSize="12"
            fontWeight="bold"
          >
            Avg
          </text>

          {/* Data line connecting points */}
          <polyline
            points={points.map(p => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            opacity="0.6"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="5"
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth="2"
              className="hover:r-7 transition-all cursor-pointer"
            >
              <title>
                Sample {i + 1}
                {'\n'}Duration: {formatDuration(p.point.durationMs)}
                {'\n'}Time: {formatTimestamp(p.point.timestamp)}
              </title>
            </circle>
          ))}

          {/* X-axis labels (sample numbers) */}
          {points.filter((_, i) => i % Math.ceil(data.length / 10) === 0 || i === data.length - 1).map((p, idx) => {
            const sampleNum = points.indexOf(p) + 1;
            return (
              <text
                key={idx}
                x={p.x}
                y={padding.top + plotHeight + 20}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="11"
              >
                #{sampleNum}
              </text>
            );
          })}

          {/* X-axis line */}
          <line
            x1={padding.left}
            y1={padding.top + plotHeight}
            x2={padding.left + plotWidth}
            y2={padding.top + plotHeight}
            stroke="#475569"
            strokeWidth="2"
          />

          {/* Y-axis line */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + plotHeight}
            stroke="#475569"
            strokeWidth="2"
          />

          {/* X-axis label */}
          <text
            x={padding.left + plotWidth / 2}
            y={chartHeight - 10}
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="13"
            fontWeight="bold"
          >
            Sample Number (Most Recent → Latest)
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-indigo-500 border-2 border-white"></div>
          <span>Individual Runs</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-sky-400"></div>
          <span>Average ({formatDuration(avgDuration)})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-3 bg-purple-400/20 border border-purple-400 border-dashed"></div>
          <span>±1 Std Dev (±{formatDuration(stdDev)})</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">n={data.length} samples</span>
        </div>
      </div>
    </div>
  );
}
