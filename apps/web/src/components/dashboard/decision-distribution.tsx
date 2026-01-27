'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatNumber, formatPercentage } from '@/lib/utils';

interface DecisionDistributionProps {
  decisions: {
    approved: number;
    hard_stop: number;
    route_to_clinician: number;
    request_more_info: number;
  };
  total: number;
}

const decisionConfig = {
  approved: {
    label: 'Approved',
    color: 'bg-success',
    textColor: 'text-success',
  },
  route_to_clinician: {
    label: 'Route',
    color: 'bg-warning',
    textColor: 'text-warning',
  },
  hard_stop: {
    label: 'Stop',
    color: 'bg-destructive',
    textColor: 'text-destructive',
  },
  request_more_info: {
    label: 'Info',
    color: 'bg-info',
    textColor: 'text-info',
  },
};

export function DecisionDistribution({ decisions, total }: DecisionDistributionProps) {
  const segments = [
    { key: 'approved', value: decisions.approved },
    { key: 'route_to_clinician', value: decisions.route_to_clinician },
    { key: 'hard_stop', value: decisions.hard_stop },
    { key: 'request_more_info', value: decisions.request_more_info },
  ].filter((s) => s.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Decisions (Last 24h)</CardTitle>
          <span className="text-muted-foreground text-sm">Total: {formatNumber(total)}</span>
        </div>
      </CardHeader>
      <CardContent>
        {/* Stacked bar */}
        <div className="mb-4 flex h-4 overflow-hidden rounded-full bg-muted">
          {segments.map((segment) => {
            const config = decisionConfig[segment.key as keyof typeof decisionConfig];
            const percentage = (segment.value / total) * 100;

            return (
              <Tooltip key={segment.key}>
                <TooltipTrigger asChild>
                  <div
                    className={cn('transition-all hover:opacity-80', config.color)}
                    style={{ width: `${percentage}%` }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-center">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs">
                      {formatNumber(segment.value)} ({formatPercentage(segment.value / total)})
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {segments.map((segment) => {
            const config = decisionConfig[segment.key as keyof typeof decisionConfig];
            const percentage = segment.value / total;

            return (
              <div key={segment.key} className="flex items-center gap-2">
                <div className={cn('size-3 rounded-sm', config.color)} />
                <span className="text-muted-foreground text-sm">
                  {config.label}:{' '}
                  <span className={cn('font-medium', config.textColor)}>
                    {formatNumber(segment.value)}
                  </span>
                  <span className="text-muted-foreground ml-1">
                    ({formatPercentage(percentage)})
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
