'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

const ENV_MOCK_DEFAULT = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

interface SettingsContextType {
  refreshInterval: number; // in seconds, 0 = disabled
  setRefreshInterval: (interval: number) => void;
  mockMode: boolean;
  setMockMode: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'popper-dashboard-settings';

interface StoredSettings {
  refreshInterval: number;
  mockMode: boolean;
}

function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return { refreshInterval: 30, mockMode: ENV_MOCK_DEFAULT };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<StoredSettings>;
      return {
        refreshInterval: parsed.refreshInterval ?? 30,
        mockMode: parsed.mockMode ?? ENV_MOCK_DEFAULT,
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { refreshInterval: 30, mockMode: ENV_MOCK_DEFAULT };
}

function saveSettings(settings: StoredSettings) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [refreshInterval, setRefreshIntervalState] = useState(30);
  const [mockMode, setMockModeState] = useState(ENV_MOCK_DEFAULT);
  const queryClient = useQueryClient();

  // Load settings from localStorage on mount (client-side only)
  useEffect(() => {
    const settings = loadSettings();
    setRefreshIntervalState(settings.refreshInterval);
    setMockModeState(settings.mockMode);
  }, []);

  const setRefreshInterval = (interval: number) => {
    setRefreshIntervalState(interval);
    saveSettings({ refreshInterval: interval, mockMode });
  };

  const setMockMode = useCallback(
    (enabled: boolean) => {
      setMockModeState(enabled);
      saveSettings({ refreshInterval, mockMode: enabled });
      // Invalidate all queries so they refetch with the new data source
      queryClient.invalidateQueries();
    },
    [refreshInterval, queryClient],
  );

  return (
    <SettingsContext.Provider
      value={{ refreshInterval, setRefreshInterval, mockMode, setMockMode }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    return {
      refreshInterval: 30,
      setRefreshInterval: () => {},
      mockMode: ENV_MOCK_DEFAULT,
      setMockMode: () => {},
    };
  }
  return context;
}
