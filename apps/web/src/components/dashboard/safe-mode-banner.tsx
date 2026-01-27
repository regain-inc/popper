'use client';

import { ArrowRight01Icon, ShieldKeyIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';
import type { SafeModeState } from '@/types/api';

interface SafeModeBannerProps {
  safeMode: SafeModeState;
}

export function SafeModeBanner({ safeMode }: SafeModeBannerProps) {
  if (!safeMode.enabled) return null;

  return (
    <div className="mb-6 flex items-center justify-between rounded-lg border border-warning/50 bg-warning/10 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-warning/20">
          <HugeiconsIcon icon={ShieldKeyIcon} className="size-5 text-warning" />
        </div>
        <div>
          <p className="font-medium text-warning">
            Safe-Mode Active ({safeMode.scope === 'global' ? 'Global' : 'Organization'})
          </p>
          <p className="text-muted-foreground text-sm">
            {safeMode.reason || 'No reason provided'}
            {safeMode.effective_at && (
              <span className="ml-2">· Since {formatRelativeTime(safeMode.effective_at)}</span>
            )}
            {safeMode.effective_until && (
              <span className="ml-2">
                · Until {new Date(safeMode.effective_until).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/safe-mode" className="gap-2">
          Manage
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
