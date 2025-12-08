import { FlowRun, TaskState } from '../types';

export const getActiveRuns = (runs: FlowRun[]) => {
  // Keep ALL runs in active section (including completed/failed)
  // Only exclude if explicitly moved to history
  return runs;
};

export const getHistoryRuns = (runs: FlowRun[]) => {
  // History is now empty - all flows stay in active section until reset
  return [];
};

export const filterRunsByStatus = (
  runs: FlowRun[],
  statusFilter: 'all' | TaskState.COMPLETED | TaskState.FAILED
) => {
  if (statusFilter === 'all') return runs;
  return runs.filter(r => r.state === statusFilter);
};

export const filterRunsByFlowName = (
  runs: FlowRun[],
  flowNameFilter: string
) => {
  if (flowNameFilter === 'all') return runs;
  return runs.filter(r => r.flowName === flowNameFilter);
};

export const filterRunsBySearchQuery = (
  runs: FlowRun[],
  searchQuery: string
) => {
  if (!searchQuery.trim()) return runs;
  const query = searchQuery.toLowerCase();
  return runs.filter(r =>
    r.flowName.toLowerCase().includes(query) ||
    r.id.toLowerCase().includes(query)
  );
};

export const filterRunsByDate = (
  runs: FlowRun[],
  dateFilter: 'all' | 'today' | 'week' | 'month'
) => {
  if (dateFilter === 'all') return runs;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  return runs.filter(r => {
    const runDate = new Date(r.startTime);
    if (dateFilter === 'today') {
      return runDate >= today;
    } else if (dateFilter === 'week') {
      return runDate >= weekAgo;
    } else if (dateFilter === 'month') {
      return runDate >= monthAgo;
    }
    return true;
  });
};

export const applyAllFilters = (
  runs: FlowRun[],
  filters: {
    status: 'all' | TaskState.COMPLETED | TaskState.FAILED;
    flowName: string;
    searchQuery: string;
    date: 'all' | 'today' | 'week' | 'month';
  }
) => {
  let filteredRuns = [...runs];

  filteredRuns = filterRunsByStatus(filteredRuns, filters.status);
  filteredRuns = filterRunsByFlowName(filteredRuns, filters.flowName);
  filteredRuns = filterRunsBySearchQuery(filteredRuns, filters.searchQuery);
  filteredRuns = filterRunsByDate(filteredRuns, filters.date);

  return filteredRuns;
};

export const getUniqueFlowNames = (runs: FlowRun[]) => {
  return Array.from(new Set(runs.map(r => r.flowName))).sort();
};
