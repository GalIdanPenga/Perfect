import { useState, useEffect } from 'react';
import { ClientConfig } from '../types';
import { API_BASE_URL } from '../constants';

export const useClientConfigs = () => {
  const [availableClients, setAvailableClients] = useState<ClientConfig[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>(() => {
    // Restore selected client ID from localStorage on initial load
    return localStorage.getItem('selectedClientId') || '';
  });

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/client/configs`);
        if (response.ok) {
          const data = await response.json();
          setAvailableClients(data.clients);
          // Set default to first client only if no client is selected
          if (data.clients.length > 0 && !selectedClientId) {
            const defaultId = data.clients[0].id;
            setSelectedClientId(defaultId);
            localStorage.setItem('selectedClientId', defaultId);
          }
        }
      } catch (error) {
        console.error('Failed to fetch client configurations:', error);
      }
    };

    fetchClients();
  }, []);

  // Create a wrapper function to also persist to localStorage
  const setSelectedClientIdWithPersistence = (id: string) => {
    setSelectedClientId(id);
    localStorage.setItem('selectedClientId', id);
  };

  return { availableClients, selectedClientId, setSelectedClientId: setSelectedClientIdWithPersistence };
};
