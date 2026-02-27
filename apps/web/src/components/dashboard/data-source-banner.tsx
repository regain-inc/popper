'use client';

import { useDataSource } from '@/hooks/use-data-source';

export function DataSourceBanner() {
  const { dataSource, isBench } = useDataSource();

  if (dataSource === 'production') {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300">
        <span className="font-medium">Live supervision data</span> from the mobile app. Monitored
        for internal training and quality assurance.
      </div>
    );
  }

  if (isBench) {
    return (
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
        <span className="font-medium">Bench validation data.</span> Audit events shown are from
        automated test runs, not real patients.
      </div>
    );
  }

  return null;
}
