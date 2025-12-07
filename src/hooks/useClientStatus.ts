import { useState, useEffect } from 'react';
import { ClientConfig } from '../types';
import { API_BASE_URL, POLLING_INTERVALS } from '../constants';

export const useClientStatus = () => {
  const [clientStatus, setClientStatus] = useState<'stopped' | 'starting' | 'running' | 'error'>('stopped');
  const [activeClient, setActiveClient] = useState<ClientConfig | null>(null);

  useEffect(() => {
    const checkClientStatus = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/client/status`);
        const data = await response.json();
        setClientStatus(data.status);
        setActiveClient(data.activeClient || null);
      } catch (error) {
        // Backend not running yet
      }
    };

    checkClientStatus();
    const interval = setInterval(checkClientStatus, POLLING_INTERVALS.CLIENT_STATUS);
    return () => clearInterval(interval);
  }, []);

  return { clientStatus, setClientStatus, activeClient };
};
