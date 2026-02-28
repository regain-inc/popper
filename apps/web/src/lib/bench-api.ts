const BENCH_BASE = 'https://bench-api.regain.ai';

/** Fetch data from the bench API directly (cross-subdomain cookies on .regain.ai) */
export async function benchFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BENCH_BASE}/api/v1${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Bench API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}
