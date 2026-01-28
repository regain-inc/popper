'use client';

import { Download01Icon, SecurityCheckIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AuditChart } from '@/components/audit/audit-chart';
import { AuditFilters } from '@/components/audit/audit-filters';
import { AuditPagination } from '@/components/audit/audit-pagination';
import { AuditTable } from '@/components/audit/audit-table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuditEvents, useAuditTimeseries } from '@/hooks/use-audit-events';
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

export default function ComplianceAuditPage() {
  // No organization filter - always global view for compliance
  const [filters, setFilters] = useState<AuditEventsParams>({
    limit: LIMIT,
    offset: 0,
    // No organization_id - global view
  });

  // Fetch data - no organization filter for compliance
  const {
    data: eventsData,
    isLoading: eventsLoading,
    error: eventsError,
  } = useAuditEvents(filters);

  // Timeseries params - compute "since" once and memoize
  const [timeseriesSince] = useState(() =>
    new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  );

  const timeseriesParams = useMemo(
    () => ({
      since: timeseriesSince,
      bucket: 'hour' as const,
      group_by: 'decision' as const,
      // No organization_id - global view
    }),
    [timeseriesSince],
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
          <p className="text-muted-foreground text-sm">
            De-identified supervision decisions (read-only)
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">Failed to load audit data</p>
          <p className="text-muted-foreground mt-1 text-sm">{errorMessage}</p>
        </div>
      </div>
    );
  }

  const handleFiltersChange = (newFilters: AuditEventsParams) => {
    // Remove organization_id if accidentally set
    const { organization_id: _, ...safeFilters } = newFilters;
    setFilters({ ...safeFilters, offset: 0 }); // Reset to first page on filter change
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
      'Subject (De-identified)',
      'Summary',
    ];
    const rows = eventsData.events.map((e) => [
      e.id,
      e.occurred_at,
      e.event_type,
      e.tags?.decision || '',
      e.mode,
      e.trace.trace_id,
      e.subject.subject_id, // Already de-identified
      e.summary.replace(/,/g, ';'),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-audit-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('CSV exported successfully (de-identified data)');
  };

  const handleExportJSON = () => {
    if (!eventsData?.events.length) return;

    const blob = new Blob([JSON.stringify(eventsData.events, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `compliance-audit-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast.success('JSON exported successfully (de-identified data)');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">
            De-identified supervision decisions (read-only)
          </p>
        </div>
        <AuditSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground text-sm">
            De-identified supervision decisions across all organizations
          </p>
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

      {/* Compliance notice */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="flex items-center gap-3 py-3">
          <HugeiconsIcon icon={SecurityCheckIcon} className="text-amber-600 size-5" />
          <div className="flex-1">
            <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
              Compliance View - All Data De-identified
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Subject IDs are pseudonymized. No PHI is displayed.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
          >
            Read-Only
          </Badge>
        </CardContent>
      </Card>

      {/* Time-series chart */}
      {timeseriesData && (
        <AuditChart data={timeseriesData.buckets} totalEvents={timeseriesData.total_events} />
      )}

      {/* Filters */}
      <AuditFilters filters={filters} onFiltersChange={handleFiltersChange} />

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
