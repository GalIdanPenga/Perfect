import React, { useState } from 'react';
import {
  Clock,
  Filter,
  Search,
  Hash,
  Calendar,
  ChevronRight,
  ChevronDown,
  Trash2,
  X,
} from 'lucide-react';
import { TaskState, FlowRun } from '../types';
import { API_BASE_URL } from '../constants';
import { StatusIcon } from './StatusComponents';
import { TagBadges } from './TagBadges';
import { ActiveRunCard } from './ActiveRunCard';
import { ConfirmDialog } from './dialogs/ConfirmDialog';
import {
  applyAllFilters,
  getUniqueFlowNames,
} from '../utils/filterUtils';

interface HistoryPanelProps {
  runs: FlowRun[];
  themeColor: string;
  onDeleteRun: (runId: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  runs,
  themeColor,
  onDeleteRun,
  onBulkDelete,
}) => {
  // Filter state
  const [statusFilter, setStatusFilter] = useState<'all' | TaskState.COMPLETED | TaskState.FAILED>('all');
  const [flowNameFilter, setFlowNameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Selection / expansion state
  const [selectedHistoryRunId, setSelectedHistoryRunId] = useState<string | null>(null);
  const [closingHistoryRunId, setClosingHistoryRunId] = useState<string | null>(null);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(new Set());

  // Delete confirmation state
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [pendingDeleteRunId, setPendingDeleteRunId] = useState<string | null>(null);
  const [showBulkDeleteConfirmation, setShowBulkDeleteConfirmation] = useState(false);

  const historyRuns = applyAllFilters(runs, {
    status: statusFilter,
    flowName: flowNameFilter,
    searchQuery,
    date: dateFilter,
  });

  const uniqueFlowNames = getUniqueFlowNames(runs);

  const hasActiveFilters =
    statusFilter !== 'all' ||
    flowNameFilter !== 'all' ||
    searchQuery.trim() !== '' ||
    dateFilter !== 'all';

  const clearFilters = () => {
    setStatusFilter('all');
    setFlowNameFilter('all');
    setSearchQuery('');
    setDateFilter('all');
    setShowAllHistory(false);
  };

  const handleHistoryClick = (runId: string) => {
    if (runId === selectedHistoryRunId) {
      setClosingHistoryRunId(runId);
      setTimeout(() => {
        setSelectedHistoryRunId(null);
        setClosingHistoryRunId(null);
      }, 300);
    } else {
      setClosingHistoryRunId(null);
      setSelectedHistoryRunId(runId);
    }
  };

  const handleToggleRunSelection = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    setSelectedRunIds(prev => {
      const next = new Set(prev);
      next.has(runId) ? next.delete(runId) : next.add(runId);
      return next;
    });
  };

  const handleSelectAllRuns = () => {
    if (selectedRunIds.size === historyRuns.length) {
      setSelectedRunIds(new Set());
    } else {
      setSelectedRunIds(new Set(historyRuns.map(r => r.id)));
    }
  };

  const handleDeleteRunClick = (e: React.MouseEvent, runId: string) => {
    e.stopPropagation();
    setPendingDeleteRunId(runId);
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDeleteRun = async () => {
    if (pendingDeleteRunId) {
      if (selectedHistoryRunId === pendingDeleteRunId) {
        setSelectedHistoryRunId(null);
      }
      await onDeleteRun(pendingDeleteRunId);
    }
    setShowDeleteConfirmation(false);
    setPendingDeleteRunId(null);
  };

  const handleConfirmBulkDelete = async () => {
    const ids = Array.from(selectedRunIds);
    if (selectedHistoryRunId && selectedRunIds.has(selectedHistoryRunId)) {
      setSelectedHistoryRunId(null);
    }
    setSelectedRunIds(new Set());
    await onBulkDelete(ids);
    setShowBulkDeleteConfirmation(false);
  };

  if (runs.length === 0) return null;

  return (
    <div className="mt-6 border-t border-slate-800 pt-4 mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
          <Clock size={14} /> Execution History
          <span className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full text-xs font-mono">
            {historyRuns.length}
          </span>
        </h3>
        <div className="flex items-center gap-2">
          {selectedRunIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteConfirmation(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 border border-rose-500/50 rounded-md text-xs font-bold text-rose-400 hover:bg-rose-500/30 transition-all shadow-sm"
            >
              <Trash2 size={12} />
              Delete ({selectedRunIds.size})
            </button>
          )}
          {historyRuns.length > 0 && (
            <button
              onClick={handleSelectAllRuns}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-slate-400 hover:text-slate-300 hover:border-slate-600 transition-all shadow-sm"
            >
              {selectedRunIds.size === historyRuns.length && historyRuns.length > 0
                ? 'Deselect All'
                : 'Select All'}
            </button>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-md text-xs font-bold text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10 transition-all shadow-sm group"
            >
              <X size={12} className="group-hover:text-rose-400" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap gap-2 mb-3 p-3 bg-slate-800/30 border border-slate-700/50 rounded-lg">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by flow name, ID, or tag values..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-3 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors placeholder:text-slate-600"
          />
        </div>

        <div className="relative">
          <Filter size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
          >
            <option value="all">All Status</option>
            <option value={TaskState.COMPLETED}>Completed</option>
            <option value={TaskState.FAILED}>Failed</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>

        {uniqueFlowNames.length > 0 && (
          <div className="relative">
            <Hash size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
            <select
              value={flowNameFilter}
              onChange={(e) => setFlowNameFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
            >
              <option value="all">All Flows</option>
              {uniqueFlowNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
          </div>
        )}

        <div className="relative">
          <Calendar size={12} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="bg-slate-900 border border-slate-700 text-xs text-slate-300 rounded-md py-2 pl-9 pr-8 appearance-none focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 cursor-pointer hover:border-slate-600 transition-colors"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last 7 Days</option>
            <option value="month">Last 30 Days</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
        </div>
      </div>

      {/* Run List */}
      {historyRuns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-600">
          <Filter size={32} className="mb-3 text-slate-700" />
          <p className="text-sm font-medium text-slate-400">No matching runs found</p>
          <p className="text-xs text-slate-600 mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            {historyRuns.slice(0, showAllHistory ? historyRuns.length : 10).map(run => {
              const runColor = run.clientColor || themeColor;
              const isSelected = selectedHistoryRunId === run.id;
              return (
                <React.Fragment key={run.id}>
                  <div
                    onClick={() => handleHistoryClick(run.id)}
                    className={`group bg-slate-800/40 p-2.5 rounded-lg border transition-all cursor-pointer hover:bg-slate-800/60 ${isSelected ? 'animate-selectPulse' : ''} relative overflow-hidden`}
                    style={{
                      borderColor: isSelected ? runColor : selectedRunIds.has(run.id) ? '#94a3b8' : '#475569',
                      backgroundColor: isSelected
                        ? `${runColor}15`
                        : selectedRunIds.has(run.id)
                        ? 'rgba(148, 163, 184, 0.1)'
                        : 'rgba(30, 41, 59, 0.4)',
                      boxShadow: isSelected ? `0 0 20px ${runColor}30` : 'none',
                    }}
                  >
                    {/* Checkbox */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-10 flex items-center justify-center z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => handleToggleRunSelection(e, run.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                          selectedRunIds.has(run.id)
                            ? 'bg-sky-500 border-sky-500 text-white translate-x-0 opacity-100'
                            : 'border-slate-500 bg-slate-800 -translate-x-8 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 hover:border-sky-400'
                        }`}
                      >
                        {selectedRunIds.has(run.id) && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    </div>

                    <div className={`flex items-center justify-between gap-4 transition-all duration-200 ${selectedRunIds.has(run.id) ? 'ml-8' : 'group-hover:ml-8'}`}>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <StatusIcon state={run.state} size={16} />
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="font-semibold text-sm transition-colors"
                            style={{ color: isSelected ? runColor : '#cbd5e1' }}
                            title={run.flowName}
                          >
                            {run.flowName}
                          </span>
                          {run.tags && Object.keys(run.tags).length > 0 && (
                            <TagBadges tags={run.tags} />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                        <Clock size={12} />
                        <span>{new Date(run.startTime).toLocaleTimeString()}</span>
                      </div>
                      <span
                        className="text-sm font-bold font-mono w-12 text-right"
                        style={{ color: run.state === TaskState.FAILED ? '#f87171' : isSelected ? runColor : '#38bdf8' }}
                      >
                        {run.progress}%
                      </span>
                      <button
                        onClick={(e) => handleDeleteRunClick(e, run.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                        title="Delete run"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {(isSelected || closingHistoryRunId === run.id) && (
                    <div
                      className="ml-4 overflow-hidden"
                      style={{
                        animation: closingHistoryRunId === run.id
                          ? 'smoothCollapse 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards'
                          : 'smoothExpand 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards',
                      }}
                    >
                      <div className="pt-2">
                        <ActiveRunCard run={run} clientColor={run.clientColor} />
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {historyRuns.length > 10 && (
            <div className="flex justify-center mt-3">
              <button
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border rounded-lg text-xs font-medium transition-all shadow-sm group"
                style={{ borderColor: '#475569', color: '#94a3b8' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeColor;
                  e.currentTarget.style.borderColor = `${themeColor}80`;
                  e.currentTarget.style.backgroundColor = `${themeColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.borderColor = '#475569';
                  e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
                }}
              >
                <span>{showAllHistory ? 'Show Less' : `Show All (${historyRuns.length} total)`}</span>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${showAllHistory ? 'rotate-90' : 'rotate-0'} group-hover:translate-x-0.5`}
                />
              </button>
            </div>
          )}
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirmation}
        title="Delete Run"
        message="Are you sure you want to delete this run?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        themeColor="#ef4444"
        onConfirm={handleConfirmDeleteRun}
        onCancel={() => { setShowDeleteConfirmation(false); setPendingDeleteRunId(null); }}
      />

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        isOpen={showBulkDeleteConfirmation}
        title="Delete Runs"
        message={`Are you sure you want to delete ${selectedRunIds.size} run${selectedRunIds.size !== 1 ? 's' : ''}?`}
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        themeColor="#ef4444"
        onConfirm={handleConfirmBulkDelete}
        onCancel={() => setShowBulkDeleteConfirmation(false)}
      />
    </div>
  );
};
