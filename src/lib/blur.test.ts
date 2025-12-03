import { describe, it, expect } from 'vitest';
import { blurDataURL } from './blur';

describe('blur utilities', () => {
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
});

