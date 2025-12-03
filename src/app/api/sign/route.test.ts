import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from './route';
import { v2 as cloudinary } from 'cloudinary';

vi.mock('cloudinary', () => ({
  v2: {
    utils: {
      api_sign_request: vi.fn(),
    },
  },
}));

describe('/api/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
    process.env.CLOUDINARY_API_KEY = 'test-key';
    process.env.CLOUDINARY_API_SECRET = 'test-secret';
    process.env.CLOUDINARY_UPLOAD_PRESET = 'test-preset';
    delete process.env.CLOUDINARY_FOLDER;
  });

  it('should sign request with GET', async () => {
    vi.mocked(cloudinary.utils.api_sign_request).mockReturnValue('test-signature');

    const response = await GET();
    const data = await response.json();

    expect(data.cloudName).toBe('test-cloud');
    expect(data.apiKey).toBe('test-key');
    expect(data.uploadPreset).toBe('test-preset');
    expect(data.folder).toBe('social-ai-poc');
    expect(data.signature).toBe('test-signature');
    expect(data.timestamp).toBeTypeOf('number');
    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Number),
        folder: 'social-ai-poc',
        upload_preset: 'test-preset',
      }),
      'test-secret'
    );
  });

  it('should sign request with POST', async () => {
    vi.mocked(cloudinary.utils.api_sign_request).mockReturnValue('test-signature');

    const response = await POST();
    const data = await response.json();

    expect(data.signature).toBe('test-signature');
    expect(cloudinary.utils.api_sign_request).toHaveBeenCalled();
  });

  it('should use custom folder from env', async () => {
    process.env.CLOUDINARY_FOLDER = 'custom-folder';
    vi.mocked(cloudinary.utils.api_sign_request).mockReturnValue('sig');

    const response = await GET();
    const data = await response.json();

    expect(data.folder).toBe('custom-folder');
    expect(cloudinary.utils.api_sign_request).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'custom-folder' }),
      expect.any(String)
    );
  });
});

