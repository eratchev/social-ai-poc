import { describe, it, expect, beforeEach, vi } from 'vitest';
import { middleware } from './middleware';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('next/server', async () => {
  const actual = await vi.importActual('next/server');
  return {
    ...actual,
    NextResponse: {
      next: vi.fn(() => ({ type: 'next' })),
      redirect: vi.fn((url) => ({ type: 'redirect', url })),
    },
  };
});

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createRequest(pathname: string, cookieValue?: string): NextRequest {
    const url = `http://localhost${pathname}`;
    const headers = new Headers();
    if (cookieValue) {
      headers.set('cookie', `site_access=${cookieValue}`);
    }
    return {
      nextUrl: {
        pathname,
        search: '',
        clone: () => ({
          pathname,
          search: '',
          searchParams: {
            set: vi.fn(),
          },
        }),
      },
      cookies: {
        get: (name: string) => {
          if (name === 'site_access' && cookieValue) {
            return { value: cookieValue };
          }
          return undefined;
        },
      },
    } as any;
  }

  it('should allow access to public paths', () => {
    const req = createRequest('/unlock');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should allow access to unlock API', () => {
    const req = createRequest('/api/unlock');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should allow access to favicon', () => {
    const req = createRequest('/favicon.ico');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should allow access to shared story pages', () => {
    const req = createRequest('/s/test-slug');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should allow access to shared story API', () => {
    const req = createRequest('/api/story/by-slug/test-slug');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should skip _next paths', () => {
    const req = createRequest('/_next/static/chunk.js');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should skip static paths', () => {
    const req = createRequest('/static/image.jpg');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should allow access when cookie is granted', () => {
    const req = createRequest('/protected', 'granted');
    const result = middleware(req);
    expect(result.type).toBe('next');
  });

  it('should redirect to unlock when not granted', () => {
    const req = createRequest('/protected');
    const result = middleware(req);
    expect(result.type).toBe('redirect');
  });

  it('should redirect with next parameter', () => {
    const req = createRequest('/protected?param=value');
    const result = middleware(req);
    expect(result.type).toBe('redirect');
  });

  it('should not allow access with wrong cookie value', () => {
    const req = createRequest('/protected', 'wrong');
    const result = middleware(req);
    expect(result.type).toBe('redirect');
  });
});

