'use client';

import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/** Organization ID used by bench validation runs when calling Popper supervision API */
const BENCH_ORG_ID = '00000000-0000-0000-0000-000000000000';

export type DataSource = 'production' | 'bench';

interface DataSourceContextType {
  dataSource: DataSource;
  setDataSource: (source: DataSource) => void;
  /** Organization ID to pass to Popper API calls. undefined = all (production), BENCH_ORG_ID (bench). */
  organizationId: string | undefined;
  /** Human-readable label for the current data source */
  dataSourceLabel: string;
  isBench: boolean;
}

const DataSourceContext = createContext<DataSourceContextType | null>(null);

const STORAGE_KEY = 'popper-data-source';

function loadDataSource(): DataSource {
  if (typeof window === 'undefined') return 'production';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'bench') return 'bench';
  } catch {
    /* ignore */
  }
  return 'production';
}

export function DataSourceProvider({ children }: { children: ReactNode }) {
  const [dataSource, setDataSourceState] = useState<DataSource>('production');
  const queryClient = useQueryClient();

  useEffect(() => {
    setDataSourceState(loadDataSource());
  }, []);

  const setDataSource = useCallback(
    (source: DataSource) => {
      setDataSourceState(source);
      try {
        localStorage.setItem(STORAGE_KEY, source);
      } catch {
        /* ignore */
      }
      queryClient.invalidateQueries();
    },
    [queryClient],
  );

  const organizationId = dataSource === 'bench' ? BENCH_ORG_ID : undefined;
  const isBench = dataSource === 'bench';
  const dataSourceLabel = isBench ? 'Bench (Test Runs)' : 'Production (Mobile App)';

  return (
    <DataSourceContext.Provider
      value={{ dataSource, setDataSource, organizationId, dataSourceLabel, isBench }}
    >
      {children}
    </DataSourceContext.Provider>
  );
}

export function useDataSource() {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error('useDataSource must be used within DataSourceProvider');
  }
  return context;
}
