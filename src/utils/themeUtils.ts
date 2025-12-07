import { ClientConfig } from '../types';
import { DEFAULT_THEME_COLOR } from '../constants';

export const getThemeColor = (
  selectedClient: ClientConfig | undefined,
  activeClient: ClientConfig | null
): string => {
  return selectedClient?.color || activeClient?.color || DEFAULT_THEME_COLOR;
};
