import { useState, useEffect } from 'react';
import { FlowRun } from '../types';
import { API_BASE_URL, POLLING_INTERVALS } from '../constants';

export const useFlowRuns = () => {
  const [runs, setRuns] = useState<FlowRun[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const runsRes = await fetch(`${API_BASE_URL}/engine/runs`);

        if (runsRes.ok) {
          const runsData = await runsRes.json();
          setRuns(runsData);
        }
      } catch (error) {
        console.error('Failed to fetch data from backend:', error);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, POLLING_INTERVALS.RUNS);
    return () => clearInterval(interval);
  }, []);

  return runs;
};
