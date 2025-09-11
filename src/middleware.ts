import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/unlock',
  '/api/unlock',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files and public paths
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    PUBLIC_PATHS.some((p) => pathname === p)
  ) {
    return NextResponse.next();
  }

  // Already unlocked?
  const cookie = req.cookies.get('site_access');
  if (cookie?.value === 'granted') {
    return NextResponse.next();
  }

  // Redirect to unlock page
  const url = req.nextUrl.clone();
  url.pathname = '/unlock';
  url.searchParams.set('next', pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: '/:path*',
};
