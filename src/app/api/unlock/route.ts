import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get('next') || '/';
  const form = await req.formData();
  const password = String(form.get('password') || '');

  if (!process.env.ACCESS_PASSWORD) {
    return new NextResponse('Server not configured', { status: 500 });
  }

  if (password !== process.env.ACCESS_PASSWORD) {
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
