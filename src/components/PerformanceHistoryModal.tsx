import React, { useEffect, useState } from 'react';
import { X, TrendingUp } from 'lucide-react';
import { TimeSeriesChart } from './TimeSeriesChart';

interface HistoryDataPoint {
  runId: string;
  timestamp: string;
  durationMs: number;
}

interface PerformanceHistoryModalProps {
  type: 'task' | 'flow';
  flowName: string;
  taskName?: string;
  onClose: () => void;
}

export function PerformanceHistoryModal({ type, flowName, taskName, onClose }: PerformanceHistoryModalProps) {
  const [history, setHistory] = useState<HistoryDataPoint[]>([]);
  const [avgDuration, setAvgDuration] = useState<number>(0);
  const [stdDev, setStdDev] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isOpening, setIsOpening] = useState(true);

  useEffect(() => {
    fetchHistory();
    requestAnimationFrame(() => {
      setIsOpening(false);
    });
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const url = type === 'task'
        ? `http://localhost:3001/api/statistics/task-history/${encodeURIComponent(flowName)}/${encodeURIComponent(taskName!)}`
        : `http://localhost:3001/api/statistics/flow-history/${encodeURIComponent(flowName)}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        setHistory(data.history || []);
        if (data.stats) {
          setAvgDuration(data.stats.avgDurationMs);
          setStdDev(data.stats.stdDevDurationMs || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const title = type === 'task'
    ? `${flowName} / ${taskName}`
    : flowName;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
        isClosing || isOpening ? 'opacity-0' : 'opacity-100'
      }`}
      onClick={handleClose}
    >
      <div
        className={`bg-slate-900 rounded-xl border border-slate-700 shadow-2xl w-[95vw] max-w-[1100px] max-h-[90vh] flex flex-col transition-all duration-200 ${
          isClosing || isOpening ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <TrendingUp className="text-sky-400" size={24} />
            <div>
              <h2 className="text-xl font-bold text-white">Performance History</h2>
              <p className="text-sm text-slate-400 font-mono mt-1">{title}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="text-slate-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400">Loading history...</div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <TrendingUp size={48} className="text-slate-600 mx-auto mb-4" />
                <div className="text-slate-400">No historical data available</div>
                <div className="text-sm text-slate-500 mt-2">
                  Data will appear after completing more runs
                </div>
              </div>
            </div>
          ) : (
            <TimeSeriesChart
              data={history}
              avgDuration={avgDuration}
              stdDev={stdDev}
              title={`${history.length} Historical Samples`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
