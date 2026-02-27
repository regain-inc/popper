'use client';

import {
  Activity01Icon,
  FileValidationIcon,
  ShieldKeyIcon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { DecisionDistribution } from '@/components/dashboard/decision-distribution';
import { DriftSignals } from '@/components/dashboard/drift-signals';
import { SafeModeBanner } from '@/components/dashboard/safe-mode-banner';
import { StatusCard } from '@/components/dashboard/status-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDataSource } from '@/hooks/use-data-source';
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

export default function StatusPage() {
  const { organizationId } = useDataSource();
  const { data: status, isLoading, error } = useStatus(organizationId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
          <p className="text-muted-foreground text-sm">System health and metrics overview</p>
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
          <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
          <p className="text-muted-foreground text-sm">
            System health and metrics overview
            {status.organization.name && <span> · {status.organization.name}</span>}
          </p>
        </div>
        <div className="text-muted-foreground text-xs">Auto-refreshes every 30s</div>
      </div>

      {/* Safe-mode banner */}
      <SafeModeBanner safeMode={status.safe_mode} />

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
    </div>
  );
}
