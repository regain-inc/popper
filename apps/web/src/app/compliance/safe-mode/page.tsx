'use client';

import {
  Building02Icon,
  Globe02Icon,
  SecurityCheckIcon,
  ShieldKeyIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useSafeMode, useSafeModeHistory } from '@/hooks/use-safe-mode';
import { cn } from '@/lib/utils';

function SafeModeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[150px] rounded-xl" />
        <Skeleton className="h-[150px] rounded-xl" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

export default function ComplianceSafeModePage() {
  const [historyFilter, setHistoryFilter] = useState<'all' | 'global' | 'organization'>('all');

  // Fetch global safe mode state (no org filter for compliance)
  const { data: globalSafeMode, isLoading: safeModeLoading } = useSafeMode();
  // Fetch all history (no org filter - global view)
  const { data: historyData, isLoading: historyLoading } = useSafeModeHistory();

  const isLoading = safeModeLoading || historyLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safe-Mode History</h1>
          <p className="text-muted-foreground text-sm">View safe-mode state changes (read-only)</p>
        </div>
        <SafeModeSkeleton />
      </div>
    );
  }

  const filteredHistory = (historyData?.history || []).filter((entry) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'global') return entry.scope === 'global';
    return entry.scope === 'organization';
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Safe-Mode History</h1>
        <p className="text-muted-foreground text-sm">
          View safe-mode state changes across all organizations (read-only)
        </p>
      </div>

      {/* Compliance notice */}
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
        <CardContent className="flex items-center gap-3 py-3">
          <HugeiconsIcon icon={SecurityCheckIcon} className="text-amber-600 size-5" />
          <div className="flex-1">
            <p className="text-amber-800 dark:text-amber-200 text-sm font-medium">
              Compliance View - Read-Only Access
            </p>
            <p className="text-amber-600 dark:text-amber-400 text-xs">
              Safe-mode controls are not available in compliance view. Contact Ops team for changes.
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

      {/* Current state cards (read-only) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Global Safe-Mode Status */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Globe02Icon} className="text-muted-foreground size-5" />
              <CardTitle className="text-base font-medium">Global Safe-Mode</CardTitle>
            </div>
            <CardDescription>System-wide safety status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'size-3 rounded-full',
                  globalSafeMode?.enabled ? 'bg-amber-500 animate-pulse' : 'bg-green-500',
                )}
              />
              <span className="text-xl font-semibold">
                {globalSafeMode?.enabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            {globalSafeMode?.enabled && globalSafeMode.reason && (
              <p className="text-muted-foreground mt-2 text-sm">Reason: {globalSafeMode.reason}</p>
            )}
            {globalSafeMode?.enabled && globalSafeMode.effective_until && (
              <p className="text-muted-foreground text-xs">
                Active until: {new Date(globalSafeMode.effective_until).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={ShieldKeyIcon} className="text-muted-foreground size-5" />
              <CardTitle className="text-base font-medium">History Summary</CardTitle>
            </div>
            <CardDescription>Safe-mode activation statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground text-xs uppercase">Total Events</p>
                <p className="text-2xl font-semibold">{historyData?.history.length || 0}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">Activations</p>
                <p className="text-2xl font-semibold">
                  {historyData?.history.filter((h) => h.enabled).length || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">Global Events</p>
                <p className="text-xl font-semibold">
                  {historyData?.history.filter((h) => h.scope === 'global').length || 0}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase">Org Events</p>
                <p className="text-xl font-semibold">
                  {historyData?.history.filter((h) => h.scope === 'organization').length || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Safe-Mode History</CardTitle>
            <Select
              value={historyFilter}
              onValueChange={(v) => setHistoryFilter(v as 'all' | 'global' | 'organization')}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="global">Global only</SelectItem>
                <SelectItem value="organization">Org only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredHistory.length === 0 ? (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
              No history entries
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Time</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                    <TableHead className="w-[100px]">Scope</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="w-[140px]">Duration</TableHead>
                    <TableHead className="w-[140px]">By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredHistory.map((entry) => {
                    const ScopeIcon = entry.scope === 'global' ? Globe02Icon : Building02Icon;

                    return (
                      <TableRow key={entry.id}>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(entry.effective_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.enabled ? 'warning' : 'success'}
                            className="capitalize"
                          >
                            {entry.enabled ? 'Enabled' : 'Disabled'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <HugeiconsIcon
                              icon={ScopeIcon}
                              className="text-muted-foreground size-4"
                            />
                            <span
                              className={cn(
                                'text-sm capitalize',
                                entry.scope === 'global' ? 'font-medium' : 'text-muted-foreground',
                              )}
                            >
                              {entry.scope === 'global'
                                ? 'Global'
                                : entry.organization_id?.replace('org_', '') || 'Org'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm">
                          {entry.reason}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.effective_until
                            ? new Date(entry.effective_until).toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Indefinite'}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {entry.created_by.split('@')[0]}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
