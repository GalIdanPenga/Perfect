import { Play, XCircle } from 'lucide-react';
import { WorkerConfig } from '../types';
import { darkenHexColor } from '../utils/colorUtils';

interface WorkerSelectorProps {
  availableWorkers: WorkerConfig[];
  selectedWorkerId: string | null;
  workerStatus: 'stopped' | 'starting' | 'running' | 'error';
  themeColor: string;
  isStartingWorker: boolean;
  onWorkerClick: (workerId: string) => void;
  onStart: () => void;
  onStop: () => void;
}

export function WorkerSelector({
  availableWorkers,
  selectedWorkerId,
  workerStatus,
  themeColor,
  isStartingWorker,
  onWorkerClick,
  onStart,
  onStop,
}: WorkerSelectorProps) {
  const isActive = workerStatus === 'running' || workerStatus === 'starting';

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-center max-w-md w-full shadow-2xl">
      <h3 className="text-base font-bold text-slate-300 mb-1">Worker</h3>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Start the worker to register and automatically execute workflows.
      </p>

      {availableWorkers.length > 0 && (
        <div className="mb-4 text-left">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select Worker Configuration
          </label>
          <div className="space-y-1.5">
            {availableWorkers.map(worker => {
              const isSelected = selectedWorkerId === worker.id;
              const clientColor = worker.color || '#0ea5e9';

              return (
                <button
                  key={worker.id}
                  onClick={() => onWorkerClick(worker.id)}
                  disabled={isActive}
                  className="w-full text-left p-3 rounded-lg border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group relative overflow-hidden"
                  style={{
                    borderColor: isSelected ? clientColor : '#334155',
                    background: isSelected
                      ? `linear-gradient(135deg, ${clientColor}18 0%, ${clientColor}08 100%)`
                      : 'rgba(15, 23, 42, 0.5)',
                    boxShadow: isSelected
                      ? `0 0 25px ${clientColor}40, inset 0 1px 0 ${clientColor}20`
                      : 'none'
                  }}
                >
                  {isSelected && worker.color && (
                    <div
                      className="absolute inset-0 rounded-lg opacity-50 blur-md -z-10"
                      style={{ background: clientColor }}
                    />
                  )}
                  <div className="flex items-start gap-2.5">
                    {worker.color && (
                      <div
                        className="mt-0.5 w-6 h-6 rounded-md flex items-center justify-center shadow-lg relative"
                        style={{
                          background: `linear-gradient(135deg, ${worker.color} 0%, ${worker.color}cc 100%)`,
                          boxShadow: `0 2px 8px ${worker.color}60, inset 0 1px 0 rgba(255,255,255,0.2)`
                        }}
                      >
                        <div className="w-2 h-2 bg-white/90 rounded-full" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div
                        className="text-sm font-bold mb-0.5 transition-colors"
                        style={{ color: isSelected ? clientColor : '#cbd5e1' }}
                      >
                        {worker.name}
                      </div>
                      <div className="text-xs text-slate-500 leading-snug">
                        {worker.description}
                      </div>
                    </div>
                    <div
                      className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-white/50' : 'border-slate-600 bg-slate-900'
                      }`}
                      style={{ backgroundColor: isSelected ? clientColor : undefined }}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {workerStatus === 'stopped' || workerStatus === 'error' ? (
        <button
          onClick={onStart}
          disabled={isStartingWorker}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 text-white rounded-lg font-medium text-sm transition-all shadow-lg disabled:text-slate-500 disabled:cursor-not-allowed active:scale-95 disabled:bg-slate-700"
          style={{
            backgroundColor: isStartingWorker ? '#334155' : themeColor,
            boxShadow: isStartingWorker ? 'none' : `0 10px 30px ${themeColor}40, 0 0 20px ${themeColor}30`
          }}
          onMouseEnter={(e) => {
            if (!isStartingWorker) {
              e.currentTarget.style.backgroundColor = darkenHexColor(themeColor, 20);
            }
          }}
          onMouseLeave={(e) => {
            if (!isStartingWorker) {
              e.currentTarget.style.backgroundColor = themeColor;
            }
          }}
        >
          <Play size={20} className="fill-current" />
          {isStartingWorker ? 'Starting...' : 'Start Worker'}
        </button>
      ) : (
        <button
          onClick={onStop}
          className="w-full flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-rose-500 text-slate-300 hover:text-white rounded-lg font-medium text-sm transition-all shadow-lg active:scale-95"
        >
          <XCircle size={18} />
          Stop Worker
        </button>
      )}

      <p className="text-xs text-slate-500 mt-3 leading-snug">
        {workerStatus === 'running'
          ? 'Worker is connected. Flows will auto-execute upon registration.'
          : 'Once started, all registered flows will execute automatically.'}
      </p>
    </div>
  );
}
