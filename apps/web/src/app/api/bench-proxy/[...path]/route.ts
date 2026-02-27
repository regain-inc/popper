import { type NextRequest, NextResponse } from 'next/server';

const BENCH_API_URL = process.env.BENCH_API_URL || 'https://bench-api.regain.ai';

async function proxyRequest(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = path.join('/');
  const url = new URL(request.url);
  const targetUrl = `${BENCH_API_URL}/${targetPath}${url.search}`;

  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
  headers.set('Accept', 'application/json');

  // Forward cookies for Better Auth session
  const cookie = request.headers.get('Cookie');
  if (cookie) headers.set('Cookie', cookie);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
  });

  const responseHeaders = new Headers();
  const contentType = response.headers.get('Content-Type');
  if (contentType) responseHeaders.set('Content-Type', contentType);

  // Forward Set-Cookie headers from backend
  const setCookies = response.headers.getSetCookie();
  for (const c of setCookies) {
    responseHeaders.append('Set-Cookie', c);
  }

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
