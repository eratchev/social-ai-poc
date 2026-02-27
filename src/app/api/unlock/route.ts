import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const rawNext = url.searchParams.get('next') || '/';
  // Only allow relative paths — reject absolute URLs and protocol-relative URLs
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';
  const form = await req.formData();
  const password = String(form.get('password') || '');

  if (!process.env.UNLOCK_PASSWORD) {
    return new NextResponse('Server not configured', { status: 500 });
  }

  if (password !== process.env.UNLOCK_PASSWORD) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const res = NextResponse.redirect(new URL(next, url.origin));
  res.cookies.set('site_access', 'granted', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
