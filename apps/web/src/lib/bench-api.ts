function getBenchApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/bench-proxy`;
  }
  return 'http://localhost:3001';
}

const BENCH_BASE = getBenchApiBaseUrl();

/** Fetch data from the bench API through the proxy */
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
