import React, { useEffect, useState } from 'react';
import { X, BarChart3, TrendingUp, Clock, LineChart } from 'lucide-react';
import { PerformanceHistoryModal } from './PerformanceHistoryModal';

interface TaskStatistic {
  flowName: string;
  taskName: string;
  avgDurationMs: number;
  stdDevDurationMs: number;
  sampleCount: number;
  lastUpdated: string;
}

interface FlowStatistic {
  flowName: string;
  avgDurationMs: number;
  stdDevDurationMs: number;
  sampleCount: number;
  lastUpdated: string;
}

interface StatisticsWindowProps {
  onClose: () => void;
}

export function StatisticsWindow({ onClose }: StatisticsWindowProps) {
  const [statistics, setStatistics] = useState<TaskStatistic[]>([]);
  const [flowStatistics, setFlowStatistics] = useState<FlowStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupByFlow, setGroupByFlow] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);
  const [selectedChart, setSelectedChart] = useState<{ type: 'task' | 'flow'; flowName: string; taskName?: string } | null>(null);

  useEffect(() => {
    fetchStatistics();
    // Trigger opening animation
    requestAnimationFrame(() => {
      setIsOpening(false);
    });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200); // Match animation duration
  };

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:3001/api/statistics');
      const data = await response.json();
      if (data.success) {
        setStatistics(data.taskStatistics || []);
        setFlowStatistics(data.flowStatistics || []);
      }
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Group statistics by flow
  const groupedStats = statistics.reduce((acc, stat) => {
    if (!acc[stat.flowName]) {
      acc[stat.flowName] = [];
    }
    acc[stat.flowName].push(stat);
    return acc;
  }, {} as Record<string, TaskStatistic[]>);

  const totalSamples = statistics.reduce((sum, stat) => sum + stat.sampleCount, 0);
  const totalFlows = Object.keys(groupedStats).length;
  const totalTasks = statistics.length;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing || isOpening ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-[90vw] h-[85vh] flex flex-col transition-all duration-200 ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <BarChart3 className="text-sky-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Task Statistics</h2>
              <p className="text-sm text-slate-400">
                Historical performance data from flow executions
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 p-6 border-b border-slate-700">
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-sky-400 mb-2">
              <TrendingUp size={16} />
              <span className="text-sm font-semibold uppercase tracking-wider">Total Flows</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalFlows}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <BarChart3 size={16} />
              <span className="text-sm font-semibold uppercase tracking-wider">Total Tasks</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalTasks}</div>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Clock size={16} />
              <span className="text-sm font-semibold uppercase tracking-wider">Total Samples</span>
            </div>
            <div className="text-2xl font-bold text-white">{totalSamples}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-3 border-b border-slate-700 flex items-center justify-between">
          <button
            onClick={() => setGroupByFlow(!groupByFlow)}
            className="text-sm px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            {groupByFlow ? 'Ungroup' : 'Group by Flow'}
          </button>
          <button
            onClick={fetchStatistics}
            className="text-sm px-3 py-1.5 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400">Loading statistics...</div>
            </div>
          ) : statistics.length === 0 && flowStatistics.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <BarChart3 size={48} className="text-slate-600 mx-auto mb-4" />
                <div className="text-slate-400">No statistics available yet</div>
                <div className="text-sm text-slate-500 mt-2">
                  Statistics will appear after flows complete
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Flow Statistics Section */}
              {flowStatistics.length > 0 && (
                <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                  <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <TrendingUp size={18} className="text-sky-400" />
                        Flow Statistics
                      </h3>
                      <span className="text-sm text-slate-400">
                        Average completion times per flow
                      </span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left px-4 py-2 text-slate-400 font-semibold">Flow Name</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Avg Duration</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Std Dev (±)</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Samples</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Last Updated</th>
                          <th className="text-center px-4 py-2 text-slate-400 font-semibold">Chart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flowStatistics.map((stat, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-white font-semibold">{stat.flowName}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sky-400 font-bold text-base">
                                {formatDuration(stat.avgDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-purple-400 font-semibold">
                                {formatDuration(stat.stdDevDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-emerald-400 font-semibold">
                                {stat.sampleCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {formatDate(stat.lastUpdated)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedChart({ type: 'flow', flowName: stat.flowName })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors text-xs font-semibold"
                              >
                                <LineChart size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Task Statistics Section */}
              {statistics.length > 0 && (
                groupByFlow ? (
            <div className="space-y-6">
              {Object.entries(groupedStats).map(([flowName, tasks]: [string, TaskStatistic[]]) => (
                <div key={flowName} className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                  {/* Flow Header */}
                  <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-700">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">{flowName}</h3>
                      <span className="text-sm text-slate-400">
                        {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Tasks Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left px-4 py-2 text-slate-400 font-semibold">Task Name</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Avg Duration</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Std Dev (±)</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Samples</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Last Updated</th>
                          <th className="text-center px-4 py-2 text-slate-400 font-semibold">Chart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((stat, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-300 font-mono">{stat.taskName}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sky-400 font-semibold">
                                {formatDuration(stat.avgDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-purple-400 font-semibold">
                                {formatDuration(stat.stdDevDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-emerald-400 font-semibold">
                                {stat.sampleCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {formatDate(stat.lastUpdated)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedChart({ type: 'task', flowName: flowName, taskName: stat.taskName })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors text-xs font-semibold"
                              >
                                <LineChart size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
                ) : (
                  <div className="bg-slate-800/30 rounded-lg border border-slate-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-700">
                          <th className="text-left px-4 py-2 text-slate-400 font-semibold">Flow Name</th>
                          <th className="text-left px-4 py-2 text-slate-400 font-semibold">Task Name</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Avg Duration</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Std Dev (±)</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Samples</th>
                          <th className="text-right px-4 py-2 text-slate-400 font-semibold">Last Updated</th>
                          <th className="text-center px-4 py-2 text-slate-400 font-semibold">Chart</th>
                        </tr>
                      </thead>
                      <tbody>
                        {statistics.map((stat, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-slate-800 last:border-0 hover:bg-slate-800/30 transition-colors"
                          >
                            <td className="px-4 py-3 text-slate-300">{stat.flowName}</td>
                            <td className="px-4 py-3 text-slate-300 font-mono">{stat.taskName}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sky-400 font-semibold">
                                {formatDuration(stat.avgDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-purple-400 font-semibold">
                                {formatDuration(stat.stdDevDurationMs)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-emerald-400 font-semibold">
                                {stat.sampleCount}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">
                              {formatDate(stat.lastUpdated)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedChart({ type: 'task', flowName: stat.flowName, taskName: stat.taskName })}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 transition-colors text-xs font-semibold"
                              >
                                <LineChart size={14} />
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance History Modal */}
      {selectedChart && (
        <PerformanceHistoryModal
          type={selectedChart.type}
          flowName={selectedChart.flowName}
          taskName={selectedChart.taskName}
          onClose={() => setSelectedChart(null)}
        />
      )}
    </div>
  );
}
