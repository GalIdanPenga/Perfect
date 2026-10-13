import { useState, useEffect } from 'react';
import { WorkerConfig } from '../types';
import { API_BASE_URL } from '../constants';
import { useLocalStorage } from './useLocalStorage';

export const useWorkerConfigs = () => {
  const [availableWorkers, setAvailableWorkers] = useState<WorkerConfig[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useLocalStorage<string>('selectedWorkerId', '');

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/worker/configs`);
        if (response.ok) {
          const data = await response.json();
          setAvailableWorkers(data.workers);
          if (data.workers.length > 0 && !selectedWorkerId) {
            setSelectedWorkerId(data.workers[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch worker configurations:', error);
      }
    };

    fetchWorkers();
  }, []);

  return { availableWorkers, selectedWorkerId, setSelectedWorkerId };
};
