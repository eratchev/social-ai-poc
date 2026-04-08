import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GalleryLive from './GalleryLive';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

type Photo = { id: string; storageUrl: string; width: number | null; height: number | null; publicId: string | null };

const twoPhotos: Photo[] = [
  { id: 'p1', storageUrl: 'https://res.cloudinary.com/test/image/upload/v1/img1.jpg', width: 800, height: 600, publicId: 'img1' },
  { id: 'p2', storageUrl: 'https://res.cloudinary.com/test/image/upload/v1/img2.jpg', width: 800, height: 600, publicId: 'img2' },
];

describe('GalleryLive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all photos from initial prop', () => {
    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);
    expect(screen.getAllByRole('img').length).toBe(2);
  });

  it('shows a delete button for each photo', () => {
    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);
    const btns = screen.getAllByRole('button', { name: /delete photo/i });
    expect(btns.length).toBe(2);
  });

  it('removes photo optimistically when delete button is clicked', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(1);
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/photos/p1', { method: 'DELETE' });
  });

  it('restores photo when delete API returns non-404 error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(2);
    });
  });

  it('treats 404 response as success (photo already gone)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as any);

    render(<GalleryLive roomCode="ABC" initial={twoPhotos} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete photo/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBe(1);
    });
  });

  it('renders empty state when no photos', () => {
    render(<GalleryLive roomCode="ABC" initial={[]} />);
    expect(screen.getByText(/no images yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete photo/i })).not.toBeInTheDocument();
  });
});
