import { useState, useEffect } from 'react';
import { WorkerConfig } from '../types';
import { API_BASE_URL, POLLING_INTERVALS } from '../constants';

export const useWorkerStatus = () => {
  const [workerStatus, setWorkerStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [activeWorker, setActiveWorker] = useState<WorkerConfig | null>(null);

  useEffect(() => {
    const checkWorkerStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/worker/status`);
        const data = await response.json();
        setWorkerStatus(data.status);
        setActiveWorker(data.activeWorker || null);
      } catch (error) {
        // Backend not running yet
      }
    };

    checkWorkerStatus();
    const interval = setInterval(checkWorkerStatus, POLLING_INTERVALS.WORKER_STATUS);
    return () => clearInterval(interval);
  }, []);

  return { workerStatus, setWorkerStatus, activeWorker };
};
