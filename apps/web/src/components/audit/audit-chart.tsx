'use client';

import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatNumber } from '@/lib/utils';
import type { TimeseriesBucket } from '@/types/api';

interface AuditChartProps {
  data: TimeseriesBucket[];
  totalEvents: number;
  onBarClick?: (timestamp: string) => void;
}

const decisionColors = {
  APPROVED: 'oklch(72% 0.19 142)', // success
  ROUTE_TO_CLINICIAN: 'oklch(75% 0.18 85)', // warning
  HARD_STOP: 'oklch(57.7% 0.245 27.33)', // destructive
  REQUEST_MORE_INFO: 'oklch(62% 0.19 250)', // info
};

function formatHour(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    hour12: true,
  });
}

interface TooltipPayload {
  dataKey: string;
  value: number;
  color: string;
  name: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !label) return null;

  const date = new Date(label);
  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);

  return (
    <div className="bg-popover rounded-lg border p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium">
        {date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}
      </p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-muted-foreground">{entry.name}</span>
            </div>
            <span className="font-medium">{formatNumber(entry.value)}</span>
          </div>
        ))}
        <div className="border-t pt-1 mt-1">
          <div className="flex items-center justify-between text-sm font-medium">
            <span>Total</span>
            <span>{formatNumber(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuditChart({ data, totalEvents, onBarClick }: AuditChartProps) {
  const chartData = data.map((bucket) => ({
    timestamp: bucket.timestamp,
    APPROVED: bucket.counts.APPROVED || 0,
    ROUTE_TO_CLINICIAN: bucket.counts.ROUTE_TO_CLINICIAN || 0,
    HARD_STOP: bucket.counts.HARD_STOP || 0,
    REQUEST_MORE_INFO: bucket.counts.REQUEST_MORE_INFO || 0,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">Event Volume (Last 24h)</CardTitle>
          <span className="text-muted-foreground text-sm">Total: {formatNumber(totalEvents)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              onClick={(e) => {
                if (e?.activePayload?.[0] && onBarClick) {
                  onBarClick(e.activePayload[0].payload.timestamp as string);
                }
              }}
            >
              <XAxis
                dataKey="timestamp"
                tickFormatter={formatHour}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => formatNumber(value)}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'oklch(50% 0 0 / 0.1)' }} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value: string) => {
                  const labels: Record<string, string> = {
                    APPROVED: 'Approved',
                    ROUTE_TO_CLINICIAN: 'Route',
                    HARD_STOP: 'Stop',
                    REQUEST_MORE_INFO: 'Info',
                  };
                  return labels[value] || value;
                }}
              />
              <Bar
                dataKey="APPROVED"
                stackId="a"
                fill={decisionColors.APPROVED}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="ROUTE_TO_CLINICIAN"
                stackId="a"
                fill={decisionColors.ROUTE_TO_CLINICIAN}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="HARD_STOP"
                stackId="a"
                fill={decisionColors.HARD_STOP}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="REQUEST_MORE_INFO"
                stackId="a"
                fill={decisionColors.REQUEST_MORE_INFO}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
