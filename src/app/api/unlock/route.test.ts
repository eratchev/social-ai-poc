import { describe, it, expect, beforeEach, vi } from 'vitest';
import { POST } from './route';

// Helper to create a mock request with formData
function createMockRequest(url: string, formData: Record<string, string>) {
  const mockFormData = {
    get: (key: string) => formData[key] || null,
  } as FormData;

  const request = {
    url,
    formData: vi.fn().mockResolvedValue(mockFormData),
  } as unknown as Request;

  return request;
}

describe('/api/unlock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ACCESS_PASSWORD;
  });

  it('should return 500 when ACCESS_PASSWORD is not set', async () => {
    const request = createMockRequest('http://localhost/api/unlock', {
      password: 'test',
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).toBe('Server not configured');
  });

  it('should return 401 when password is incorrect', async () => {
    process.env.ACCESS_PASSWORD = 'correct-password';
    const request = createMockRequest('http://localhost/api/unlock', {
      password: 'wrong-password',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(text).toBe('Unauthorized');
  });

  it('should set cookie and redirect when password is correct', async () => {
    process.env.ACCESS_PASSWORD = 'correct-password';
    const request = createMockRequest('http://localhost/api/unlock?next=/dashboard', {
      password: 'correct-password',
    });

    const response = await POST(request);
    expect(response.status).toBe(307); // redirect
    const cookie = response.headers.get('set-cookie');
    expect(cookie).toContain('site_access=granted');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toMatch(/SameSite=(Lax|lax)/i);
  });

  it('should redirect to default path when next is not provided', async () => {
    process.env.ACCESS_PASSWORD = 'correct-password';
    const request = createMockRequest('http://localhost/api/unlock', {
      password: 'correct-password',
    });

    const response = await POST(request);
    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    expect(location).toContain('/');
  });
});

