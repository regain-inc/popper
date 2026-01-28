'use client';

import {
  Activity01Icon,
  FileValidationIcon,
  ShieldKeyIcon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { DecisionDistribution } from '@/components/dashboard/decision-distribution';
import { DriftSignals } from '@/components/dashboard/drift-signals';
import { StatusCard } from '@/components/dashboard/status-card';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStatus } from '@/hooks/use-status';
import { formatDuration } from '@/lib/utils';

function StatusSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
        <Skeleton className="h-[104px] rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    </div>
  );
}

export default function ComplianceOverviewPage() {
  // Always fetch global (aggregated) status - no organization filter
  const { data: status, isLoading, error } = useStatus(undefined, 30);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Overview</h1>
          <p className="text-muted-foreground text-sm">Aggregated system metrics (de-identified)</p>
        </div>
        <StatusSkeleton />
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Unable to load status</p>
          <p className="text-muted-foreground text-sm">Please try again later</p>
        </div>
      </div>
    );
  }

  const healthStatus = status.service.healthy ? 'normal' : 'critical';
  const safeModeStatus = status.safe_mode.enabled ? 'warning' : 'normal';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Compliance Overview</h1>
          <p className="text-muted-foreground text-sm">
            Aggregated system metrics across all organizations (de-identified)
          </p>
        </div>
        <div className="text-muted-foreground text-xs">Auto-refreshes every 30s</div>
      </div>

      {/* Safe-mode status card (read-only, no controls) */}
      {status.safe_mode.enabled && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-amber-800 dark:text-amber-200 text-base">
                Safe-Mode Active
              </CardTitle>
              <Badge
                variant="outline"
                className="border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-300"
              >
                {status.safe_mode.scope === 'global' ? 'Global' : 'Organization'}
              </Badge>
            </div>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              {status.safe_mode.reason || 'Safety mode is currently active'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="text-amber-600 dark:text-amber-400 text-xs">
              {status.safe_mode.effective_until
                ? `Active until: ${new Date(status.safe_mode.effective_until).toLocaleString()}`
                : 'Active indefinitely'}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatusCard
          title="Service"
          value={status.service.healthy ? 'Healthy' : 'Unhealthy'}
          subtitle={`v${status.service.version} · ${formatDuration(status.service.uptime_seconds)} uptime`}
          icon={Activity01Icon}
          status={healthStatus}
        />

        <StatusCard
          title="Safe-Mode"
          value={status.safe_mode.enabled ? 'Enabled' : 'Disabled'}
          subtitle={
            status.safe_mode.enabled
              ? status.safe_mode.reason || 'Active'
              : 'System operating normally'
          }
          icon={ShieldKeyIcon}
          status={safeModeStatus}
        />

        <StatusCard
          title="Policy"
          value={status.policy.active_pack}
          subtitle={`v${status.policy.version} · ${status.policy.rules_count} rules`}
          icon={FileValidationIcon}
          status="info"
        />

        <StatusCard
          title="Drift"
          value={status.drift.status.charAt(0).toUpperCase() + status.drift.status.slice(1)}
          subtitle={`${status.drift.signals.length} signals monitored`}
          icon={Timer01Icon}
          status={status.drift.status}
        />
      </div>

      {/* Charts and signals */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DecisionDistribution
          decisions={status.counters.decisions}
          total={status.counters.requests_total}
        />

        <DriftSignals signals={status.drift.signals} overallStatus={status.drift.status} />
      </div>

      {/* Compliance notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Compliance Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            <strong>De-identification:</strong> All patient identifiers are replaced with
            pseudonymous subject IDs. No PHI is displayed on this dashboard.
          </p>
          <p className="text-muted-foreground">
            <strong>Aggregation:</strong> Metrics shown are aggregated across all organizations. For
            organization-specific data, please contact the system administrator.
          </p>
          <p className="text-muted-foreground">
            <strong>Audit Trail:</strong> All compliance dashboard access is logged for regulatory
            compliance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
