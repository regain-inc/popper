'use client';

import { useDataSource } from '@/hooks/use-data-source';

export function DataSourceBanner() {
  const { dataSource, isBench } = useDataSource();

  if (dataSource === 'production') {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <span className="font-medium">Live supervision data</span> from the mobile app. Monitored
        for internal training and quality assurance.
      </div>
    );
  }

  if (isBench) {
    return (
      <div className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-100">
        <span className="font-medium">Bench validation data.</span> Audit events shown are from
        automated test runs, not real patients.
      </div>
    );
  }

  return null;
}
