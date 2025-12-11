import React from 'react';

interface DataPoint {
  label: string;
  avgDuration: number;
  stdDev: number;
  sampleCount: number;
}

interface PerformanceChartProps {
  data: DataPoint[];
  title: string;
}

export function PerformanceChart({ data, title }: PerformanceChartProps) {
  if (data.length === 0) {
    return null;
  }

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 40, right: 20, bottom: 80, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  // Find max value for scaling
  const maxValue = Math.max(...data.map(d => d.avgDuration + d.stdDev));
  const yScale = plotHeight / maxValue;

  const barWidth = plotWidth / data.length * 0.7;
  const barSpacing = plotWidth / data.length;

  const formatDuration = (ms: number) => {
    if (ms >= 60000) {
      return `${(ms / 60000).toFixed(2)}m`;
    } else if (ms >= 1000) {
      return `${(ms / 1000).toFixed(3)}s`;
    } else {
      return `${Math.round(ms)}ms`;
    }
  };

  return (
    <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4 overflow-x-auto">
      <h3 className="text-white font-semibold mb-4">{title}</h3>
      <svg width={chartWidth} height={chartHeight} className="mx-auto">
        {/* Y-axis grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = padding.top + plotHeight * (1 - fraction);
          const value = maxValue * fraction;
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

        {/* Bars with error ranges */}
        {data.map((point, i) => {
          const x = padding.left + i * barSpacing + (barSpacing - barWidth) / 2;
          const barHeight = point.avgDuration * yScale;
          const y = padding.top + plotHeight - barHeight;

          // Standard deviation range
          const stdDevHeight = point.stdDev * yScale;
          const errorTop = y - stdDevHeight;
          const errorBottom = y + stdDevHeight;

          return (
            <g key={i}>
              {/* Error bar (standard deviation) */}
              <line
                x1={x + barWidth / 2}
                y1={Math.max(padding.top, errorTop)}
                x2={x + barWidth / 2}
                y2={Math.min(padding.top + plotHeight, errorBottom)}
                stroke="#a78bfa"
                strokeWidth="2"
              />
              {/* Error caps */}
              <line
                x1={x + barWidth / 2 - 5}
                y1={Math.max(padding.top, errorTop)}
                x2={x + barWidth / 2 + 5}
                y2={Math.max(padding.top, errorTop)}
                stroke="#a78bfa"
                strokeWidth="2"
              />
              <line
                x1={x + barWidth / 2 - 5}
                y1={Math.min(padding.top + plotHeight, errorBottom)}
                x2={x + barWidth / 2 + 5}
                y2={Math.min(padding.top + plotHeight, errorBottom)}
                stroke="#a78bfa"
                strokeWidth="2"
              />

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#barGradient)"
                className="hover:opacity-80 transition-opacity cursor-pointer"
              >
                <title>
                  {point.label}
                  {'\n'}Avg: {formatDuration(point.avgDuration)}
                  {'\n'}StdDev: ±{formatDuration(point.stdDev)}
                  {'\n'}Samples: {point.sampleCount}
                </title>
              </rect>

              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={padding.top + plotHeight + 15}
                textAnchor="end"
                fill="#cbd5e1"
                fontSize="11"
                transform={`rotate(-45, ${x + barWidth / 2}, ${padding.top + plotHeight + 15})`}
                className="font-mono"
              >
                {point.label.length > 20 ? point.label.substring(0, 20) + '...' : point.label}
              </text>

              {/* Sample count badge */}
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
                className="font-mono"
              >
                n={point.sampleCount}
              </text>
            </g>
          );
        })}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.9" />
          </linearGradient>
        </defs>

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
      </svg>
      <div className="flex items-center justify-center gap-4 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ background: 'linear-gradient(180deg, #38bdf8 0%, #6366f1 100%)' }}></div>
          <span>Average Duration</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-purple-400"></div>
          <span>±1 Standard Deviation</span>
        </div>
      </div>
    </div>
  );
}
