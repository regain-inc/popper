'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { SafeModeCard } from '@/components/safe-mode/safe-mode-card';
import { SafeModeDialog } from '@/components/safe-mode/safe-mode-dialog';
import { SafeModeHistory } from '@/components/safe-mode/safe-mode-history';
import { Skeleton } from '@/components/ui/skeleton';
import { useOrganization } from '@/hooks/use-organization';
import { useSafeMode, useSafeModeHistory, useSetSafeMode } from '@/hooks/use-safe-mode';

function SafeModeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[200px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
      <Skeleton className="h-[300px] rounded-xl" />
    </div>
  );
}

type DialogState = {
  open: boolean;
  mode: 'enable' | 'disable';
  scope: 'global' | 'organization';
};

export default function SafeModePage() {
  const { selectedOrgId, organizations } = useOrganization();
  const selectedOrg = organizations.find((o) => o.id === selectedOrgId);

  // Fetch global and org-specific safe mode states
  const { data: globalSafeMode, isLoading: globalLoading } = useSafeMode();
  const { data: orgSafeMode, isLoading: orgLoading } = useSafeMode(selectedOrgId || undefined);
  const { data: historyData, isLoading: historyLoading } = useSafeModeHistory(
    selectedOrgId || undefined,
  );

  const setSafeMode = useSetSafeMode();

  const [dialogState, setDialogState] = useState<DialogState>({
    open: false,
    mode: 'enable',
    scope: 'global',
  });
  const [historyFilter, setHistoryFilter] = useState<'all' | 'global' | 'organization'>('all');

  const isLoading = globalLoading || orgLoading || historyLoading;

  const openDialog = (mode: 'enable' | 'disable', scope: 'global' | 'organization') => {
    setDialogState({ open: true, mode, scope });
  };

  const handleConfirm = async (reason: string, duration: string | null) => {
    const scope = dialogState.scope;
    const enabled = dialogState.mode === 'enable';

    let effectiveUntil: string | null = null;
    if (duration && duration !== 'indefinite') {
      const hours = Number.parseInt(duration.replace('h', ''), 10);
      effectiveUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    }

    try {
      await setSafeMode.mutateAsync({
        enabled,
        reason,
        organization_id: scope === 'organization' ? selectedOrgId || undefined : undefined,
        effective_until: effectiveUntil,
      });

      toast.success(
        enabled
          ? `Safe-mode enabled ${scope === 'global' ? 'globally' : 'for organization'}`
          : `Safe-mode disabled ${scope === 'global' ? 'globally' : 'for organization'}`,
      );

      setDialogState({ ...dialogState, open: false });
    } catch {
      toast.error('Failed to update safe-mode');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Safe-Mode Controls</h1>
          <p className="text-muted-foreground text-sm">Manage safety override settings</p>
        </div>
        <SafeModeSkeleton />
      </div>
    );
  }

  const defaultSafeMode = {
    enabled: false,
    reason: null,
    effective_at: null,
    effective_until: null,
    enabled_by: null,
    scope: 'global' as const,
  };

  const effectiveGlobalSafeMode = globalSafeMode || defaultSafeMode;
  const effectiveOrgSafeMode = orgSafeMode || {
    ...defaultSafeMode,
    scope: 'organization' as const,
  };

  // Org controls are disabled if global safe-mode is on
  const isOrgDisabled = effectiveGlobalSafeMode.enabled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Safe-Mode Controls</h1>
        <p className="text-muted-foreground text-sm">
          Manage safety override settings
          {selectedOrg && <span> · {selectedOrg.name}</span>}
        </p>
      </div>

      {/* Control cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SafeModeCard
          title="Global Safe-Mode"
          description="Affects ALL organizations"
          scope="global"
          state={effectiveGlobalSafeMode}
          onEnable={() => openDialog('enable', 'global')}
          onDisable={() => openDialog('disable', 'global')}
        />

        <SafeModeCard
          title={`Organization Safe-Mode${selectedOrg ? ` (${selectedOrg.name})` : ''}`}
          description={selectedOrgId ? 'Affects only this organization' : 'Select an organization'}
          scope="organization"
          state={effectiveOrgSafeMode}
          disabled={isOrgDisabled || !selectedOrgId}
          disabledMessage={
            isOrgDisabled
              ? 'Global safe-mode is active'
              : !selectedOrgId
                ? 'Select an organization from the header'
                : undefined
          }
          onEnable={() => openDialog('enable', 'organization')}
          onDisable={() => openDialog('disable', 'organization')}
        />
      </div>

      {/* History */}
      <SafeModeHistory
        history={historyData?.history || []}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
      />

      {/* Dialog */}
      <SafeModeDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState({ ...dialogState, open })}
        mode={dialogState.mode}
        scope={dialogState.scope}
        organizationName={selectedOrg?.name}
        onConfirm={handleConfirm}
        isLoading={setSafeMode.isPending}
      />
    </div>
  );
}
