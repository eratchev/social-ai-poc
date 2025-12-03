import { describe, it, expect, vi, beforeEach } from 'vitest';
import { blurDataURL } from './blur';

describe('blur utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate base64 data URL', () => {
    const result = blurDataURL(100, 100);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should use default dimensions when not provided', () => {
    const result = blurDataURL();
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('should generate different URLs for different dimensions', () => {
    const result1 = blurDataURL(100, 100);
    const result2 = blurDataURL(200, 200);
    expect(result1).not.toBe(result2);
  });

  it('should use Buffer in Node.js environment', () => {
    // In Node.js, typeof window is 'undefined'
    const result = blurDataURL(50, 50);
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
    // Verify it's valid base64
    const base64Part = result.split(',')[1];
    expect(base64Part).toBeTruthy();
  });

  it('should include SVG content in base64', () => {
    const result = blurDataURL(100, 100);
    const base64Part = result.split(',')[1];
    const decoded = Buffer.from(base64Part, 'base64').toString('utf-8');
    expect(decoded).toContain('<svg');
    expect(decoded).toContain('width="100"');
    expect(decoded).toContain('height="100"');
  });
});

