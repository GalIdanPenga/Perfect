import { useState, useEffect, useCallback } from 'react';
import { FlowRun } from '../types';
import { API_BASE_URL, POLLING_INTERVALS } from '../constants';

export const useFlowRuns = () => {
  const [runs, setRuns] = useState<FlowRun[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const runsRes = await fetch(`${API_BASE_URL}/engine/runs`);

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData);
      }
    } catch (error) {
      console.error('Failed to fetch data from backend:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLLING_INTERVALS.RUNS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { runs, refreshRuns: fetchData };
};
