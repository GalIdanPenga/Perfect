import { useState } from 'react';
import { API_BASE_URL } from '../constants';

export const useClientActions = (
  setClientStatus: (status: 'stopped' | 'starting' | 'running' | 'error') => void
) => {
  const [isStartingClient, setIsStartingClient] = useState(false);

  const handleStartClient = async (selectedClientId: string) => {
    setIsStartingClient(true);
    try {
      const response = await fetch(`${API_BASE_URL}/client/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: selectedClientId })
      });
      const data = await response.json();
      if (data.success) {
        setClientStatus('starting');
      }
    } catch (error) {
      console.error('Failed to start client:', error);
      setClientStatus('error');
    } finally {
      setIsStartingClient(false);
    }
  };

  const handleStopClient = async () => {
    try {
      await fetch(`${API_BASE_URL}/client/stop`, {
        method: 'POST'
      });
      setClientStatus('stopped');
    } catch (error) {
      console.error('Failed to stop client:', error);
    }
  };

  return { isStartingClient, handleStartClient, handleStopClient };
};
