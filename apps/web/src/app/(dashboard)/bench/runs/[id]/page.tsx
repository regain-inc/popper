'use client';

import { useParams } from 'next/navigation';
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
import { useBenchRunDetail, useBenchSupervisionMatrix } from '@/hooks/use-bench';
import { cn } from '@/lib/utils';

const DECISION_LABELS = ['APPROVED', 'HARD_STOP', 'ROUTE_TO_CLINICIAN', 'REQUEST_MORE_INFO'];

function MetricCard({
  title,
  value,
  subtitle,
  status,
}: {
  title: string;
  value: string;
  subtitle?: string;
  status?: 'good' | 'warning' | 'bad' | 'neutral';
}) {
  const statusColors = {
    good: 'border-emerald-500/30 bg-emerald-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    bad: 'border-red-500/30 bg-red-500/5',
    neutral: '',
  };

  return (
    <Card className={cn(status && statusColors[status])}>
      <CardContent className="pt-4 pb-3">
        <p className="text-muted-foreground text-xs font-medium">{title}</p>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="text-muted-foreground text-xs mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function getMetricStatus(
  val: number | null,
  goodThreshold: number,
): 'good' | 'warning' | 'bad' | 'neutral' {
  if (val == null) return 'neutral';
  if (val >= goodThreshold) return 'good';
  if (val >= goodThreshold * 0.8) return 'warning';
  return 'bad';
}

export default function BenchRunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params.id;
  const { data, isLoading, error } = useBenchRunDetail(runId);
  const { data: matrix } = useBenchSupervisionMatrix(runId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-[80px] rounded-xl" />
          <Skeleton className="h-[80px] rounded-xl" />
          <Skeleton className="h-[80px] rounded-xl" />
          <Skeleton className="h-[80px] rounded-xl" />
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load run</p>
          <p className="text-muted-foreground text-sm">{error?.message}</p>
        </div>
      </div>
    );
  }

  const { run, vignettes } = data;
  const passRate =
    run.total_vignettes > 0 ? Math.round((run.passed / run.total_vignettes) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {run.label || `Run ${run.run_id.slice(0, 8)}`}
        </h1>
        <p className="text-muted-foreground text-sm">
          {new Date(run.timestamp).toLocaleString()} · {run.model_name} ({run.provider})
          {run.suite && (
            <>
              {' '}
              ·{' '}
              <Badge variant="outline" className="ml-1 text-[10px]">
                {run.suite}
              </Badge>
            </>
          )}
        </p>
      </div>

      {/* Run metadata */}
      <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
        {run.bench_git_sha && (
          <span>
            Bench: <code className="font-mono">{run.bench_git_sha.slice(0, 7)}</code>
          </span>
        )}
        {run.deutsch_git_sha && (
          <span>
            Deutsch: <code className="font-mono">{run.deutsch_git_sha.slice(0, 7)}</code>
          </span>
        )}
        {run.hermes_version && <span>Hermes: v{run.hermes_version}</span>}
        {run.operational_mode && <span>Mode: {run.operational_mode}</span>}
        <span>Duration: {Math.round(run.duration_ms / 1000)}s</span>
      </div>

      {/* ARPA metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <MetricCard
          title="Pass Rate"
          value={`${passRate}%`}
          subtitle={`${run.passed}/${run.total_vignettes} vignettes`}
          status={getMetricStatus(passRate, 80)}
        />
        <MetricCard
          title="Actions Appropriateness"
          value={run.arpa_actions != null ? `${Math.round(run.arpa_actions)}%` : '—'}
          status={getMetricStatus(run.arpa_actions, 80)}
        />
        <MetricCard
          title="Triage Appropriateness"
          value={run.arpa_triage != null ? `${Math.round(run.arpa_triage)}%` : '—'}
          status={getMetricStatus(run.arpa_triage, 80)}
        />
        <MetricCard
          title="KCMO"
          value={run.arpa_kcmo != null ? `${Math.round(run.arpa_kcmo)}` : '—'}
          subtitle="GDMT optimization"
          status={getMetricStatus(run.arpa_kcmo, 70)}
        />
        <MetricCard
          title="Avg Latency"
          value={run.avg_latency_ms != null ? `${Math.round(run.avg_latency_ms)}ms` : '—'}
          subtitle={
            run.p95_latency_ms != null ? `p95: ${Math.round(run.p95_latency_ms)}ms` : undefined
          }
          status="neutral"
        />
      </div>

      {/* Supervision confusion matrix */}
      {matrix && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supervision Confusion Matrix</CardTitle>
            <CardDescription>
              Expected vs. actual Popper decisions · Accuracy: {Math.round(matrix.accuracy * 100)}%
              ({matrix.correct}/{matrix.total})
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-muted-foreground p-2 text-left font-medium">
                      Expected \ Actual
                    </th>
                    {(matrix.labels || DECISION_LABELS).map((label) => (
                      <th key={label} className="text-muted-foreground p-2 text-center font-medium">
                        {label.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(matrix.labels || DECISION_LABELS).map((rowLabel, i) => (
                    <tr key={rowLabel} className="border-t">
                      <td className="text-muted-foreground p-2 font-medium">
                        {rowLabel.replace(/_/g, ' ')}
                      </td>
                      {(matrix.matrix[i] || []).map((count, j) => (
                        <td
                          key={`${rowLabel}-${(matrix.labels || DECISION_LABELS)[j]}`}
                          className={cn(
                            'p-2 text-center font-mono',
                            i === j &&
                              count > 0 &&
                              'bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-400',
                            i !== j && count > 0 && 'bg-red-500/10 text-red-700 dark:text-red-400',
                          )}
                        >
                          {count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vignette results table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vignette Results</CardTitle>
          <CardDescription>{vignettes.length} vignettes evaluated</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vignette</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Dx F1</TableHead>
                <TableHead className="text-right">KCMO</TableHead>
                <TableHead className="text-right">Halluc</TableHead>
                <TableHead className="text-right">DDI</TableHead>
                <TableHead className="text-right">Supervision</TableHead>
                <TableHead className="text-right">Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vignettes.map((v) => (
                <TableRow key={v.vignette_id}>
                  <TableCell className="font-mono text-xs">{v.vignette_id}</TableCell>
                  <TableCell>
                    <Badge
                      variant={v.status === 'passed' ? 'default' : 'destructive'}
                      className="text-[10px]"
                    >
                      {v.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {v.dx_f1 != null ? v.dx_f1.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {v.kcmo_score != null ? Math.round(v.kcmo_score) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {v.hallucinations ?? '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {v.ddi_violations ?? '—'}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {v.supervision_source || '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {v.duration_ms != null ? `${Math.round(v.duration_ms / 1000)}s` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {vignettes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground text-center py-8">
                    No vignette results
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
