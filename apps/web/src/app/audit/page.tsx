'use client';

import { Download01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AuditChart } from '@/components/audit/audit-chart';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditPagination } from '@/components/audit/audit-pagination';
import { AuditTable } from '@/components/audit/audit-table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditEvents, useAuditTimeseries } from '@/hooks/use-audit-events';
import { useOrganization } from '@/hooks/use-organization';
import type { AuditEventsParams } from '@/types/api';

const LIMIT = 50;

function AuditSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-[250px] rounded-xl" />
      <Skeleton className="h-[50px] rounded-lg" />
      <Skeleton className="h-[400px] rounded-lg" />
    </div>
  );
}

export default function AuditPage() {
  const { selectedOrgId } = useOrganization();
  const [filters, setFilters] = useState<AuditEventsParams>({
    limit: LIMIT,
    offset: 0,
    organization_id: selectedOrgId || undefined,
  });

  // Update org filter when selection changes
  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      organization_id: selectedOrgId || undefined,
    }),
    [filters, selectedOrgId],
  );

  // Fetch data - hooks must be called before any code that uses their return values
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useAuditEvents(effectiveFilters);

  // Timeseries params - compute "since" once and memoize
  const [timeseriesSince] = useState(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );

  const timeseriesParams = useMemo(
    () => ({
      since: timeseriesSince,
      bucket: 'hour' as const,
      group_by: 'decision' as const,
      organization_id: selectedOrgId || undefined,
    }),
    [selectedOrgId, timeseriesSince],
  );

  const {
    data: timeseriesData,
    isLoading: timeseriesLoading,
    error: timeseriesError,
  } = useAuditTimeseries(timeseriesParams);

  const isLoading = eventsLoading || timeseriesLoading;

  // Show error state if queries failed
  if (eventsError || timeseriesError) {
    const errorMessage =
      eventsError instanceof Error
        ? eventsError.message
        : timeseriesError instanceof Error
          ? timeseriesError.message
          : 'Unknown error';
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">View and search supervision decisions</p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">Failed to load audit data</p>
          <p className="text-muted-foreground mt-1 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  const handleFiltersChange = (newFilters: AuditEventsParams) => {
    setFilters({ ...newFilters, offset: 0 }); // Reset to first page on filter change
  };

  const handleOffsetChange = (offset: number) => {
    setFilters((prev) => ({ ...prev, offset }));
  };

  const handleTraceClick = (traceId: string) => {
    setFilters((prev) => ({
      ...prev,
      trace_id: traceId,
      offset: 0,
    }));
  };

  const handleExportCSV = () => {
    if (!eventsData?.events.length) return;

    const headers = [
      'ID',
      'Occurred At',
      'Event Type',
      'Decision',
      'Mode',
      'Trace ID',
      'Subject',
      'Summary',
    ];
    const rows = eventsData.events.map((e) => [
      e.id,
      e.occurred_at,
      e.event_type,
      e.tags?.decision || '',
      e.mode,
      e.trace.trace_id,
      e.subject.subject_id,
      e.summary.replace(/,/g, ';'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported successfully');
  };

  const handleExportJSON = () => {
    if (!eventsData?.events.length) return;

    const blob = new Blob([JSON.stringify(eventsData.events, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-events-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('JSON exported successfully');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">View and search supervision decisions</p>
        </div>
        <AuditSkeleton />
        <p className="text-muted-foreground text-xs text-center">
          Loading... Events: {eventsLoading ? 'loading' : 'ready'}, Timeseries:{' '}
          {timeseriesLoading ? 'loading' : 'ready'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">View and search supervision decisions</p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <HugeiconsIcon icon={Download01Icon} className="size-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportCSV}>Export as CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportJSON}>Export as JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Time-series chart */}
      {timeseriesData && (
        <AuditChart data={timeseriesData.buckets} totalEvents={timeseriesData.total_events} />
      )}

      {/* Filters */}
      <AuditFilters filters={effectiveFilters} onFiltersChange={handleFiltersChange} />

      {/* Table */}
      <AuditTable events={eventsData?.events || []} onTraceClick={handleTraceClick} />

      {/* Pagination */}
      {eventsData && eventsData.pagination.total > 0 && (
        <AuditPagination
          total={eventsData.pagination.total}
          offset={eventsData.pagination.offset}
          limit={eventsData.pagination.limit}
          onOffsetChange={handleOffsetChange}
        />
      )}
    </div>
  );
}
