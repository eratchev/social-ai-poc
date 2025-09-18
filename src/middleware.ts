import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/unlock',
  '/api/unlock',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

// Prefix-based public routes
const PUBLIC_PREFIXES = [
  '/s/',                 // shared story pages
  '/api/story/by-slug/', // shared story API
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/static')) {
    return NextResponse.next();
  }

  // Skip exact public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Skip public prefixes
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
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
