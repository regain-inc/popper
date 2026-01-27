'use client';

import { Building02Icon, Globe02Icon, ShieldKeyIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn, formatRelativeTime } from '@/lib/utils';
import type { SafeModeState } from '@/types/api';

interface SafeModeCardProps {
  title: string;
  description: string;
  scope: 'global' | 'organization';
  state: SafeModeState;
  disabled?: boolean;
  disabledMessage?: string;
  onEnable: () => void;
  onDisable: () => void;
}

export function SafeModeCard({
  title,
  description,
  scope,
  state,
  disabled = false,
  disabledMessage,
  onEnable,
  onDisable,
}: SafeModeCardProps) {
  const isEnabled = state.enabled;
  const Icon = scope === 'global' ? Globe02Icon : Building02Icon;

  return (
    <Card
      className={cn(
        'transition-all',
        isEnabled && 'border-warning bg-warning/5',
        disabled && 'opacity-60',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex size-10 items-center justify-center rounded-lg',
                isEnabled ? 'bg-warning/20' : 'bg-muted',
              )}
            >
              <HugeiconsIcon
                icon={ShieldKeyIcon}
                className={cn('size-5', isEnabled ? 'text-warning' : 'text-muted-foreground')}
              />
            </div>
            <div>
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <HugeiconsIcon icon={Icon} className="size-4" />
                <span>{description}</span>
              </div>
            </div>
          </div>
          <Badge variant={isEnabled ? 'warning' : 'outline'}>
            {isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {isEnabled && state.reason && (
          <div className="mb-4 rounded-lg bg-warning/10 p-3">
            <p className="text-sm font-medium text-warning">Reason</p>
            <p className="text-muted-foreground text-sm">{state.reason}</p>
            <div className="text-muted-foreground mt-2 flex gap-4 text-xs">
              {state.effective_at && <span>Since: {formatRelativeTime(state.effective_at)}</span>}
              {state.effective_until && (
                <span>Until: {new Date(state.effective_until).toLocaleString()}</span>
              )}
              {state.enabled_by && <span>By: {state.enabled_by}</span>}
            </div>
          </div>
        )}

        {disabled && disabledMessage ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-3 text-center text-sm">
            {disabledMessage}
          </div>
        ) : (
          <Button
            variant={isEnabled ? 'outline' : 'default'}
            className={cn('w-full', isEnabled && 'border-warning text-warning hover:bg-warning/10')}
            onClick={isEnabled ? onDisable : onEnable}
            disabled={disabled}
          >
            {isEnabled ? 'Disable Safe-Mode' : 'Enable Safe-Mode'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
