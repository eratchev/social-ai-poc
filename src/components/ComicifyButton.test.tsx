import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ComicifyButton from './ComicifyButton';
import type { Panel } from '@/lib/ai/structured';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

const panelsWithPhotos: Panel[] = [
  { index: 0, photoId: 'p1', narration: 'Scene one.' },
  { index: 1, photoId: 'p2', narration: 'Scene two.' },
];

const panelsNoPhotos: Panel[] = [
  { index: 0, narration: 'No photo.' },
];

const panelsAlreadyDone: Panel[] = [
  { index: 0, photoId: 'p1', generatedImageUrl: 'https://cdn.example.com/comic1.png' },
];

describe('ComicifyButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the generate button when panels have photos', () => {
    const onPanelDone = vi.fn();
    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );
    expect(screen.getByRole('button', { name: /generate comic art/i })).toBeInTheDocument();
  });

  it('renders null when no panels have a photoId', () => {
    const onPanelDone = vi.fn();
    const { container } = render(
      <ComicifyButton storyId="s1" panels={panelsNoPhotos} onPanelDone={onPanelDone} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders null when all panels-with-photos already have generatedImageUrl', () => {
    const onPanelDone = vi.fn();
    const { container } = render(
      <ComicifyButton storyId="s1" panels={panelsAlreadyDone} onPanelDone={onPanelDone} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('calls fetch for each panel with a photo in order', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      '/api/story/s1/panels/0/comicify',
      { method: 'POST' }
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      '/api/story/s1/panels/1/comicify',
      { method: 'POST' }
    );
  });

  it('calls onPanelDone for each successful panel', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(onPanelDone).toHaveBeenCalledTimes(2));
    expect(onPanelDone).toHaveBeenCalledWith(0, 'https://cdn.example.com/comic.png');
    expect(onPanelDone).toHaveBeenCalledWith(1, 'https://cdn.example.com/comic.png');
  });

  it('skips failed panels silently and continues the loop', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
      } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    // only panel 1 succeeded
    expect(onPanelDone).toHaveBeenCalledTimes(1);
    expect(onPanelDone).toHaveBeenCalledWith(1, 'https://cdn.example.com/comic.png');
  });

  it('returns to idle state when all panels fail', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);
    const onPanelDone = vi.fn();

    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
    expect(onPanelDone).not.toHaveBeenCalled();
    // Button should reappear (not show "done" state)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /generate comic art/i })).toBeInTheDocument()
    );
  });

  it('disables the button and shows progress while generating', async () => {
    let resolveFirst!: (v: unknown) => void;
    const firstPending = new Promise((res) => { resolveFirst = res; });

    mockFetch
      .mockReturnValueOnce(firstPending)
      .mockResolvedValue({
        ok: true,
        json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
      } as any);

    const onPanelDone = vi.fn();
    render(
      <ComicifyButton storyId="s1" panels={panelsWithPhotos} onPanelDone={onPanelDone} />
    );

    fireEvent.click(screen.getByRole('button', { name: /generate comic art/i }));

    // While first panel is pending, button should be disabled and show progress
    await waitFor(() => {
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      expect(btn.textContent).toMatch(/generating/i);
    });

    // Resolve and finish
    resolveFirst({
      ok: true,
      json: async () => ({ generatedImageUrl: 'https://cdn.example.com/comic.png' }),
    });

    await waitFor(() => expect(onPanelDone).toHaveBeenCalledTimes(2));
  });
});
