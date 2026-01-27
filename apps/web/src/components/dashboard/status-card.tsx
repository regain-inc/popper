'use client';

import type { IconSvgElement } from '@hugeicons/react';
import { HugeiconsIcon } from '@hugeicons/react';
import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatusCardProps {
  title: string;
  value: string | ReactNode;
  subtitle?: string;
  icon: IconSvgElement;
  status?: 'normal' | 'warning' | 'critical' | 'info';
  className?: string;
}

const statusColors = {
  normal: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
  info: 'text-info',
};

const statusDots = {
  normal: 'bg-success',
  warning: 'bg-warning',
  critical: 'bg-destructive',
  info: 'bg-info',
};

export function StatusCard({
  title,
  value,
  subtitle,
  icon,
  status = 'normal',
  className,
}: StatusCardProps) {
  return (
    <Card className={cn('py-4', className)}>
      <CardContent className="px-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm font-medium">{title}</p>
            <div className="flex items-center gap-2">
              {status && (
                <span
                  className={cn(
                    'size-2 rounded-full',
                    statusDots[status],
                    status !== 'normal' && 'animate-pulse',
                  )}
                />
              )}
              <span className={cn('text-2xl font-semibold', statusColors[status])}>{value}</span>
            </div>
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
          <div className={cn('bg-muted flex size-10 items-center justify-center rounded-lg')}>
            <HugeiconsIcon icon={icon} className={cn('size-5', statusColors[status])} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
