'use client';

import { DriftSignals } from '@/components/dashboard/drift-signals';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/use-organization';
import { useStatus } from '@/hooks/use-status';
import { cn, formatPercentage } from '@/lib/utils';

function DriftSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
      </div>
      <Skeleton className="h-[400px] rounded-xl" />
    </div>
  );
}

const statusColors = {
  normal: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
};

const statusBgColors = {
  normal: 'bg-success/10 border-success/20',
  warning: 'bg-warning/10 border-warning/20',
  critical: 'bg-destructive/10 border-destructive/20',
};

export default function DriftPage() {
  const { selectedOrgId } = useOrganization();
  const { data: status, isLoading, error } = useStatus(selectedOrgId || undefined, 30);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drift Signals</h1>
          <p className="text-muted-foreground text-sm">Anomaly detection metrics</p>
        </div>
        <DriftSkeleton />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drift Signals</h1>
          <p className="text-muted-foreground text-sm">Anomaly detection metrics</p>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive font-medium">Failed to load drift data</p>
          <p className="text-muted-foreground mt-1 text-sm">Please try again later</p>
        </div>
      </div>
    );
  }

  const driftStatus = status.drift.status;
  const signals = status.drift.signals;

  // Count signals by status
  const normalCount = signals.filter((s) => s.status === 'normal').length;
  const warningCount = signals.filter((s) => s.status === 'warning').length;
  const criticalCount = signals.filter((s) => s.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drift Signals</h1>
          <p className="text-muted-foreground text-sm">
            Anomaly detection metrics
            {status.organization.name && <span> · {status.organization.name}</span>}
          </p>
        </div>
        <div className="text-muted-foreground text-xs">Auto-refreshes every 30s</div>
      </div>

      {/* Overall Status */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* System Status */}
        <Card className={cn('border', statusBgColors[driftStatus])}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Overall Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'size-4 rounded-full',
                  driftStatus === 'normal' && 'bg-success',
                  driftStatus === 'warning' && 'bg-warning animate-pulse',
                  driftStatus === 'critical' && 'bg-destructive animate-pulse',
                )}
              />
              <span className={cn('text-2xl font-bold capitalize', statusColors[driftStatus])}>
                {driftStatus}
              </span>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {driftStatus === 'normal' && 'All metrics within normal ranges'}
              {driftStatus === 'warning' && 'Some metrics approaching thresholds'}
              {driftStatus === 'critical' && 'Critical thresholds exceeded'}
            </p>
          </CardContent>
        </Card>

        {/* Signal Counts */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Signal Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Normal</span>
                <div className="flex items-center gap-2">
                  <div className="bg-success size-2 rounded-full" />
                  <span className="text-success font-semibold">{normalCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Warning</span>
                <div className="flex items-center gap-2">
                  <div className="bg-warning size-2 rounded-full" />
                  <span className="text-warning font-semibold">{warningCount}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-sm">Critical</span>
                <div className="flex items-center gap-2">
                  <div className="bg-destructive size-2 rounded-full" />
                  <span className="text-destructive font-semibold">{criticalCount}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safe-Mode Trigger Info */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium">Auto-Trigger Info</CardTitle>
            <CardDescription>Safe-mode activation rules</CardDescription>
          </CardHeader>
          <CardContent className="text-muted-foreground space-y-2 text-sm">
            <p>
              <strong>Warning:</strong> Ops team notified
            </p>
            <p>
              <strong>Critical:</strong> Safe-mode may auto-enable
            </p>
            <p className="text-xs">Based on drift signals and policy configuration.</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Signals */}
      <DriftSignals signals={signals} overallStatus={driftStatus} />

      {/* Thresholds Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-medium">Signal Thresholds Reference</CardTitle>
          <CardDescription>Standard thresholds for drift detection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {signals.map((signal) => (
              <div key={signal.name} className="rounded-lg border p-3">
                <p className="text-sm font-medium">
                  {signal.name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                </p>
                <div className="mt-2 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Baseline:</span>
                    <span>{formatPercentage(signal.baseline_value)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-warning">Warning:</span>
                    <span>{formatPercentage(signal.threshold_warning)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-destructive">Critical:</span>
                    <span>{formatPercentage(signal.threshold_critical)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
