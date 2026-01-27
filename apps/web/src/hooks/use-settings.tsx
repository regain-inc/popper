'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

interface SettingsContextType {
  refreshInterval: number; // in seconds, 0 = disabled
  setRefreshInterval: (interval: number) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

const STORAGE_KEY = 'popper-dashboard-settings';

interface StoredSettings {
  refreshInterval: number;
}

function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') {
    return { refreshInterval: 30 };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as StoredSettings;
    }
  } catch {
    // Ignore parse errors
  }
  return { refreshInterval: 30 };
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

  // Load settings from localStorage on mount (client-side only)
  useEffect(() => {
    const settings = loadSettings();
    setRefreshIntervalState(settings.refreshInterval);
  }, []);

  const setRefreshInterval = (interval: number) => {
    setRefreshIntervalState(interval);
    saveSettings({ refreshInterval: interval });
  };

  // Always render with provider to maintain consistent context hierarchy
  return (
    <SettingsContext.Provider value={{ refreshInterval, setRefreshInterval }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    // Return defaults if not wrapped in provider
    return {
      refreshInterval: 30,
      setRefreshInterval: () => {},
    };
  }
  return context;
}
