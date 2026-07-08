import { useState, useEffect } from 'react';
import { ClientConfig } from '../types';
import { API_BASE_URL } from '../constants';
import { useLocalStorage } from './useLocalStorage';

export const useClientConfigs = () => {
  const [availableClients, setAvailableClients] = useState<ClientConfig[]>([]);
  const [selectedClientId, setSelectedClientId] = useLocalStorage<string>('selectedClientId', '');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/client/configs`);
        if (response.ok) {
          const data = await response.json();
          setAvailableClients(data.clients);
          if (data.clients.length > 0 && !selectedClientId) {
            setSelectedClientId(data.clients[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch client configurations:', error);
      }
    };

    fetchClients();
  }, []);

  return { availableClients, selectedClientId, setSelectedClientId };
};
