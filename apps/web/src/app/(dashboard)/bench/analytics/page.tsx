'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useBenchCrossModelComparison,
  useBenchProductionReadiness,
  useBenchTrends,
} from '@/hooks/use-bench';
import { cn } from '@/lib/utils';

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function BenchAnalyticsPage() {
  const { data: trendsData, isLoading: trendsLoading } = useBenchTrends(20);
  const { data: readiness, isLoading: readinessLoading } = useBenchProductionReadiness();
  const { data: crossModel, isLoading: crossModelLoading } = useBenchCrossModelComparison();

  const isLoading = trendsLoading || readinessLoading || crossModelLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bench Analytics</h1>
          <p className="text-muted-foreground text-sm">
            Trends, readiness, and cross-model comparison
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[200px] rounded-xl lg:col-span-2" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[300px] rounded-xl" />
      </div>
    );
  }

  // Prepare trend chart data (reversed so oldest first)
  const trendRuns = [...(trendsData?.runs ?? [])].reverse();
  const chartData = trendRuns.map((r) => ({
    name: r.label || formatDate(r.timestamp),
    passRate: r.total_vignettes > 0 ? Math.round((r.passed / r.total_vignettes) * 100) : 0,
    actions: r.arpa_actions != null ? Math.round(r.arpa_actions) : null,
    triage: r.arpa_triage != null ? Math.round(r.arpa_triage) : null,
    kcmo: r.arpa_kcmo != null ? Math.round(r.arpa_kcmo) : null,
  }));

  const readinessStatusColor = {
    ready: 'text-emerald-600 dark:text-emerald-400',
    nearly_ready: 'text-amber-600 dark:text-amber-400',
    not_ready: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bench Analytics</h1>
        <p className="text-muted-foreground text-sm">
          Trends, readiness, and cross-model comparison
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pass Rate Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Pass Rate Trend</CardTitle>
            <CardDescription>Last {chartData.length} runs</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="passRate"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Pass %"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="actions"
                    stroke="#6366f1"
                    strokeWidth={1.5}
                    name="Actions"
                    dot={false}
                    strokeDasharray="4 2"
                  />
                  <Line
                    type="monotone"
                    dataKey="triage"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    name="Triage"
                    dot={false}
                    strokeDasharray="4 2"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">
                No trend data available
              </p>
            )}
          </CardContent>
        </Card>

        {/* Production Readiness */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Production Readiness</CardTitle>
            <CardDescription>FDA readiness composite score</CardDescription>
          </CardHeader>
          <CardContent>
            {readiness ? (
              <div className="space-y-4">
                <div className="text-center">
                  <p className={cn('text-4xl font-bold', readinessStatusColor[readiness.status])}>
                    {Math.round(readiness.score)}%
                  </p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'mt-1',
                      readiness.status === 'ready' && 'border-emerald-500/30 text-emerald-600',
                      readiness.status === 'nearly_ready' && 'border-amber-500/30 text-amber-600',
                      readiness.status === 'not_ready' && 'border-red-500/30 text-red-600',
                    )}
                  >
                    {readiness.status.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {readiness.components.map((c) => (
                    <div key={c.name} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{c.name}</span>
                      <span
                        className={cn('font-mono', c.met ? 'text-emerald-600' : 'text-red-600')}
                      >
                        {Math.round(c.value)}/{c.target}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground py-8 text-center text-sm">No readiness data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ARPA Metric Trends */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">KCMO Trend</CardTitle>
            <CardDescription>GDMT optimization score over recent runs</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} className="text-xs" tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="kcmo"
                  stroke="#0d9488"
                  strokeWidth={2}
                  name="KCMO"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Cross-Model Comparison */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cross-Model Comparison</CardTitle>
          <CardDescription>Latest run per model with ARPA metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {crossModel?.models && crossModel.models.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead className="text-right">Pass Rate</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                  <TableHead className="text-right">Triage</TableHead>
                  <TableHead className="text-right">Halluc</TableHead>
                  <TableHead className="text-right">KCMO</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {crossModel.models.map((m) => (
                  <TableRow key={`${m.model_name}-${m.provider}`}>
                    <TableCell className="font-medium text-sm">{m.model_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{m.provider}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.total_vignettes > 0
                        ? `${Math.round((m.passed / m.total_vignettes) * 100)}%`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.arpa_actions != null ? `${Math.round(m.arpa_actions)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.arpa_triage != null ? `${Math.round(m.arpa_triage)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.arpa_halluc != null ? `${Math.round(m.arpa_halluc)}%` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.arpa_kcmo != null ? `${Math.round(m.arpa_kcmo)}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {m.avg_latency_ms != null ? `${Math.round(m.avg_latency_ms)}ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-sm">
              No cross-model comparison data available
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
