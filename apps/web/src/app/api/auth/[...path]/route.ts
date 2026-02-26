import { type NextRequest, NextResponse } from 'next/server';

const POPPER_API_URL = process.env.POPPER_INTERNAL_API_URL || 'http://localhost:3000';

async function proxyAuth(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const targetPath = path.join('/');
  const url = new URL(request.url);
  const targetUrl = `${POPPER_API_URL}/api/auth/${targetPath}${url.search}`;

  const headers = new Headers();
  const contentType = request.headers.get('Content-Type');
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Accept', request.headers.get('Accept') || 'application/json');

  // Forward cookies for session management
  const cookie = request.headers.get('Cookie');
  if (cookie) headers.set('Cookie', cookie);

  // Forward origin/referer for CSRF protection
  const origin = request.headers.get('Origin');
  if (origin) headers.set('Origin', origin);
  const referer = request.headers.get('Referer');
  if (referer) headers.set('Referer', referer);

  const response = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
    redirect: 'manual',
  });

  const responseHeaders = new Headers();
  const resContentType = response.headers.get('Content-Type');
  if (resContentType) responseHeaders.set('Content-Type', resContentType);

  // Forward Set-Cookie headers from Better Auth
  const setCookies = response.headers.getSetCookie();
  for (const cookie of setCookies) {
    responseHeaders.append('Set-Cookie', cookie);
  }

  const data = await response.text();
  return new NextResponse(data, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxyAuth;
export const POST = proxyAuth;
export const PUT = proxyAuth;
export const PATCH = proxyAuth;
export const DELETE = proxyAuth;
