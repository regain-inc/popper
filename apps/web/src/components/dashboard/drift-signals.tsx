'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn, formatPercentage } from '@/lib/utils';
import type { DriftSignal } from '@/types/api';

interface DriftSignalsProps {
  signals: DriftSignal[];
  overallStatus: 'normal' | 'warning' | 'critical';
}

const statusColors = {
  normal: 'text-success',
  warning: 'text-warning',
  critical: 'text-destructive',
};

const progressColors = {
  normal: '[&>[data-slot=progress-indicator]]:bg-success',
  warning: '[&>[data-slot=progress-indicator]]:bg-warning',
  critical: '[&>[data-slot=progress-indicator]]:bg-destructive',
};

const signalLabels: Record<string, string> = {
  hard_stop_rate: 'Hard Stop Rate',
  route_to_clinician_rate: 'Route to Clinician',
  validation_failure_rate: 'Validation Failures',
  high_uncertainty_count: 'High Uncertainty',
  decision_latency_p95: 'Latency (p95)',
};

export function DriftSignals({ signals, overallStatus }: DriftSignalsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Drift Signals</CardTitle>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 rounded-full',
                overallStatus === 'normal' && 'bg-success',
                overallStatus === 'warning' && 'bg-warning animate-pulse',
                overallStatus === 'critical' && 'bg-destructive animate-pulse',
              )}
            />
            <span className={cn('text-sm font-medium capitalize', statusColors[overallStatus])}>
              {overallStatus}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {signals.map((signal) => {
          // Calculate position on the scale (0-100)
          const maxValue = signal.threshold_critical * 1.5;
          const currentPosition = Math.min((signal.current_value / maxValue) * 100, 100);
          const warningPosition = (signal.threshold_warning / maxValue) * 100;
          const criticalPosition = (signal.threshold_critical / maxValue) * 100;

          return (
            <div key={signal.name} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {signalLabels[signal.name] || signal.name}
                </span>
                <span className={cn('font-medium', statusColors[signal.status])}>
                  {formatPercentage(signal.current_value)}
                </span>
              </div>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Progress
                      value={currentPosition}
                      className={cn('h-2 bg-muted', progressColors[signal.status])}
                    />

                    {/* Threshold markers */}
                    <div
                      className="absolute top-0 h-2 w-0.5 bg-warning/50"
                      style={{ left: `${warningPosition}%` }}
                    />
                    <div
                      className="absolute top-0 h-2 w-0.5 bg-destructive/50"
                      style={{ left: `${criticalPosition}%` }}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-1">
                    <div className="font-medium">{signalLabels[signal.name] || signal.name}</div>
                    <div className="text-xs space-y-0.5">
                      <div>Current: {formatPercentage(signal.current_value)}</div>
                      <div>Baseline: {formatPercentage(signal.baseline_value)}</div>
                      <div>Warning threshold: {formatPercentage(signal.threshold_warning)}</div>
                      <div>Critical threshold: {formatPercentage(signal.threshold_critical)}</div>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>

              <div className="text-muted-foreground flex justify-between text-xs">
                <span>Baseline: {formatPercentage(signal.baseline_value)}</span>
                <span>
                  Δ {signal.current_value > signal.baseline_value ? '+' : ''}
                  {formatPercentage(signal.current_value - signal.baseline_value)}
                </span>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
