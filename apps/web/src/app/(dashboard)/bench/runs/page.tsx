'use client';

import Link from 'next/link';
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
import { useBenchRuns } from '@/hooks/use-bench';
import { cn } from '@/lib/utils';

function formatDate(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function passRate(passed: number, total: number): string {
  if (total === 0) return '—';
  return `${Math.round((passed / total) * 100)}%`;
}

function getPassRateColor(passed: number, total: number): string {
  if (total === 0) return 'text-muted-foreground';
  const rate = passed / total;
  if (rate >= 0.9) return 'text-emerald-600 dark:text-emerald-400';
  if (rate >= 0.7) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function formatMetric(val: number | null, suffix = '%'): string {
  if (val == null) return '—';
  return `${Math.round(val)}${suffix}`;
}

export default function BenchRunsPage() {
  const { data, isLoading, error } = useBenchRuns(30);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bench Runs</h1>
          <p className="text-muted-foreground text-sm">Validation run history</p>
        </div>
        <Skeleton className="h-[500px] rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <p className="text-destructive font-medium">Failed to load bench runs</p>
          <p className="text-muted-foreground text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const runs = data?.runs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bench Runs</h1>
        <p className="text-muted-foreground text-sm">{runs.length} recent validation runs</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Run History</CardTitle>
          <CardDescription>Click a row to view run details</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Suite</TableHead>
                <TableHead className="text-right">Pass Rate</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                <TableHead className="text-right">Triage</TableHead>
                <TableHead className="text-right">KCMO</TableHead>
                <TableHead className="text-right">Latency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.run_id} className="cursor-pointer hover:bg-accent/50">
                  <TableCell>
                    <Link href={`/bench/runs/${run.run_id}`} className="block">
                      {formatDate(run.timestamp)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/bench/runs/${run.run_id}`} className="block">
                      {run.label || (
                        <span className="text-muted-foreground text-xs font-mono">
                          {run.run_id.slice(0, 8)}
                        </span>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium">{run.model_name}</span>
                      <span className="text-muted-foreground text-[10px]">{run.provider}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {run.suite}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={cn(
                        'font-medium',
                        getPassRateColor(run.passed, run.total_vignettes),
                      )}
                    >
                      {passRate(run.passed, run.total_vignettes)}
                    </span>
                    <span className="text-muted-foreground text-xs ml-1">
                      ({run.passed}/{run.total_vignettes})
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMetric(run.arpa_actions)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMetric(run.arpa_triage)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {formatMetric(run.arpa_kcmo, '')}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {run.avg_latency_ms != null ? `${Math.round(run.avg_latency_ms)}ms` : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {runs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-muted-foreground text-center py-8">
                    No bench runs found
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
