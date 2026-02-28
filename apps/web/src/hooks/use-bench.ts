'use client';

import { useQuery } from '@tanstack/react-query';
import { benchFetch } from '@/lib/bench-api';
import { useDataSource } from './use-data-source';

// ── Types (locally defined to avoid cross-repo dependency) ──

export interface BenchRun {
  run_id: string;
  suite: string;
  timestamp: string;
  duration_ms: number;
  model_name: string;
  provider: string;
  total_vignettes: number;
  passed: number;
  failed: number;
  errors: number;
  arpa_actions: number | null;
  arpa_triage: number | null;
  arpa_error_rate: number | null;
  arpa_halluc: number | null;
  arpa_kcmo: number | null;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  label: string | null;
  notes: string | null;
  operational_mode: string | null;
  hermes_version: string | null;
  control_conformance_passed: number | null;
  arpa_supervision_override_rate: number | null;
  arpa_control_reliability: number | null;
  arpa_desired_state_compliance: number | null;
  bench_git_sha: string | null;
  deutsch_git_sha: string | null;
}

export interface BenchVignetteResult {
  id: number;
  run_id: string;
  vignette_id: string;
  status: 'passed' | 'failed' | 'error';
  duration_ms: number;
  dx_f1: number | null;
  dx_correct: number | null;
  dx_missed: number | null;
  dx_spurious: number | null;
  kcmo_score: number | null;
  meds_correct: number | null;
  meds_missed: number | null;
  meds_contraindicated: number | null;
  ddi_violations: number | null;
  triage_urgency_ok: number | null;
  triage_route_ok: number | null;
  safety_decision_ok: number | null;
  hallucinations: number | null;
  htv_mean: number | null;
  supervision_source: string | null;
  supervision_latency_ms: number | null;
  critical_failures: number | null;
  all_failures: number | null;
}

export interface ProductionReadiness {
  score: number;
  status: 'ready' | 'nearly_ready' | 'not_ready';
  components: Array<{
    name: string;
    value: number;
    target: number;
    met: boolean;
    weight: number;
  }>;
  based_on_run?: string;
  run_timestamp?: string;
}

export interface SupervisionMatrixData {
  labels: string[];
  matrix: number[][];
  total: number;
  correct: number;
  accuracy: number;
}

export interface CrossModelEntry {
  model_name: string;
  provider: string;
  run_id: string;
  timestamp: string;
  passed: number;
  total_vignettes: number;
  arpa_actions: number | null;
  arpa_triage: number | null;
  arpa_error_rate: number | null;
  arpa_halluc: number | null;
  arpa_kcmo: number | null;
  avg_latency_ms: number | null;
}

// ── Hooks ──

export function useBenchRuns(limit = 20) {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-runs', limit],
    queryFn: () => benchFetch<{ runs: BenchRun[] }>(`/runs?limit=${limit}`),
    enabled: isBench,
    staleTime: 30_000,
  });
}

export function useBenchRunDetail(runId: string) {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-run', runId],
    queryFn: () =>
      benchFetch<{ run: BenchRun; vignettes: BenchVignetteResult[] }>(`/runs/${runId}`),
    enabled: isBench && !!runId,
  });
}

export function useBenchTrends(limit = 20) {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-trends', limit],
    queryFn: () => benchFetch<{ runs: BenchRun[] }>(`/trends?limit=${limit}`),
    enabled: isBench,
    staleTime: 30_000,
  });
}

export function useBenchProductionReadiness() {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-production-readiness'],
    queryFn: () => benchFetch<ProductionReadiness>('/production-readiness'),
    enabled: isBench,
    staleTime: 60_000,
  });
}

export function useBenchCrossModelComparison() {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-cross-model'],
    queryFn: () => benchFetch<{ models: CrossModelEntry[] }>('/cross-model-comparison'),
    enabled: isBench,
    staleTime: 60_000,
  });
}

export function useBenchSupervisionMatrix(runId: string) {
  const { isBench } = useDataSource();
  return useQuery({
    queryKey: ['bench-supervision-matrix', runId],
    queryFn: () => benchFetch<SupervisionMatrixData>(`/runs/${runId}/supervision-matrix`),
    enabled: isBench && !!runId,
  });
}
