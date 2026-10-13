export const API_BASE_URL = 'http://localhost:3000/api';

export const POLLING_INTERVALS = {
  RUNS: 100, // Poll every 100ms for smooth updates
  WORKER_STATUS: 200, // Poll every 200ms for faster updates
};

export const DEFAULT_THEME_COLOR = '#0ea5e9'; // sky-500

// Version shown in the header badge. Set VITE_APP_VERSION in .env.local
// (gitignored; see .env.example) to override.
export const APP_VERSION: string = (import.meta.env.VITE_APP_VERSION ?? '').trim() || 'v2.0';
