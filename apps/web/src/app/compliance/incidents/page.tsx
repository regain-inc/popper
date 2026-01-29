'use client';

import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  InformationCircleIcon,
  SecurityCheckIcon,
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
import { getIncidentStatusColor, getTriggerLevelColor, useIncidents } from '@/hooks/use-incidents';
import { cn } from '@/lib/utils';

function IncidentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-4">
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
        <Skeleton className="h-[100px] rounded-xl" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

export default function ComplianceIncidentsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'open'>('all');

  // Fetch all incidents (no org filter for compliance - global view)
  const { data, isLoading, error } = useIncidents(undefined, statusFilter);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident History</h1>
          <p className="text-muted-foreground text-sm">
            View safety incidents across all organizations (read-only)
          </p>
        </div>
        <IncidentsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incident History</h1>
          <p className="text-muted-foreground text-sm">
            View safety incidents across all organizations (read-only)
          </p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">Failed to load incidents</p>
        </div>
      </div>
    );
  }

  const incidents = data?.incidents || [];
  const openCount = incidents.filter((i) => i.status === 'open').length;
  const acknowledgedCount = incidents.filter((i) => i.status === 'acknowledged').length;
  const resolvedCount = incidents.filter((i) => i.status === 'resolved').length;
  const criticalCount = incidents.filter((i) => i.trigger_level === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Incident History</h1>
        <p className="text-muted-foreground text-sm">
          View safety incidents across all organizations (read-only)
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
              Incident management actions are not available. Contact Ops team to resolve incidents.
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

      {/* Filter */}
      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'open')}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Incidents</SelectItem>
            <SelectItem value="open">Open Only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        <Card className={cn(openCount > 0 && 'border-destructive/50 bg-destructive/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={AlertCircleIcon} className="text-destructive size-5" />
              <span className="text-2xl font-bold">{openCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(acknowledgedCount > 0 && 'border-warning/50 bg-warning/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Acknowledged
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Clock01Icon} className="text-warning size-5" />
              <span className="text-2xl font-bold">{acknowledgedCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} className="text-success size-5" />
              <span className="text-2xl font-bold">{resolvedCount}</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(criticalCount > 0 && 'border-destructive/50 bg-destructive/5')}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={SecurityCheckIcon} className="text-destructive size-5" />
              <span className="text-2xl font-bold">{criticalCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Incidents Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Incident History</CardTitle>
          <CardDescription>
            {incidents.length} incident{incidents.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {incidents.length === 0 ? (
            <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
              <div className="text-center">
                <HugeiconsIcon
                  icon={InformationCircleIcon}
                  className="mx-auto mb-2 size-8 opacity-50"
                />
                <p>No incidents found</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Time</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[100px]">Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead className="w-[140px]">Signal</TableHead>
                    <TableHead className="w-[140px]">Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(incident.created_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getIncidentStatusColor(incident.status) as 'default'}>
                          {incident.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {incident.trigger_level && (
                          <Badge
                            variant={getTriggerLevelColor(incident.trigger_level) as 'default'}
                          >
                            {incident.trigger_level}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <p className="truncate font-medium">{incident.title}</p>
                        {incident.description && (
                          <p className="text-muted-foreground truncate text-xs">
                            {incident.description}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {incident.trigger_signal?.replace(/_/g, ' ') || '-'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {incident.status === 'resolved' ? (
                          <span title={incident.resolution_notes || undefined}>
                            {incident.resolved_by?.split('@')[0] || 'system'}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
