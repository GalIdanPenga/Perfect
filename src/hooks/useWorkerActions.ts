import { useState } from 'react';
import { API_BASE_URL } from '../constants';

export const useWorkerActions = (
  setWorkerStatus: (status: 'stopped' | 'starting' | 'running' | 'error') => void,
  setSessionStartTime: (time: string | null) => void,
  refreshRuns?: () => Promise<void>
) => {
  const [isStartingWorker, setIsStartingWorker] = useState(false);

  const handleStartWorker = async (selectedWorkerId: string) => {
    setIsStartingWorker(true);

    // Set session start time immediately with a small buffer (2 seconds earlier)
    // to ensure we capture all flows that start around this time
    const now = new Date();
    now.setSeconds(now.getSeconds() - 2);
    const sessionStart = now.toISOString();
    setSessionStartTime(sessionStart);

    try {
      const response = await fetch(`${API_BASE_URL}/worker/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workerId: selectedWorkerId })
      });
      const data = await response.json();
      if (data.success) {
        setWorkerStatus('starting');
      }
    } catch (error) {
      console.error('Failed to start worker:', error);
      setWorkerStatus('error');
      // Clear session start time on error
      setSessionStartTime(null);
    } finally {
      setIsStartingWorker(false);
    }
  };

  const handleStopWorker = async (clearSession: boolean = false) => {
    try {
      await fetch(`${API_BASE_URL}/worker/stop`, {
        method: 'POST'
      });
      setWorkerStatus('stopped');

      // Only clear session when explicitly requested (e.g., returning to worker selection)
      if (clearSession) {
        setSessionStartTime(null);
      }

      // Wait for the flows to be failed (100ms + small buffer), then refresh
      if (refreshRuns) {
        setTimeout(async () => {
          await refreshRuns();
        }, 200);
      }
    } catch (error) {
      console.error('Failed to stop worker:', error);
    }
  };

  return { isStartingWorker, handleStartWorker, handleStopWorker };
};
