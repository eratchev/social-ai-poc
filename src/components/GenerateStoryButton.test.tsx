import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GenerateStoryButton from './GenerateStoryButton';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

type FetchCall = { url: string; method: string };

function makeFetch(handler: (call: FetchCall) => Promise<{ ok: boolean; data: unknown }>) {
  return vi.fn().mockImplementation((url: string, options?: RequestInit) => {
    const method = options?.method ?? 'GET';
    return handler({ url, method }).then(({ ok, data }) => ({
      ok,
      json: () => Promise.resolve(data),
    }));
  });
}

describe('GenerateStoryButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders a generate button', () => {
    render(<GenerateStoryButton roomCode="TEST" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows Beats, Panels, Narrative step labels while loading', async () => {
    // All fetches hang so the component stays in loading state
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    // setLoading(true) fires synchronously before the first await, so steps appear immediately
    expect(screen.getByText('Beats')).toBeInTheDocument();
    expect(screen.getByText('Panels')).toBeInTheDocument();
    expect(screen.getByText('Narrative')).toBeInTheDocument();
  });

  it('shows error message when init fails', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(async () => ({ ok: false, data: { error: 'internal_error' } }))
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getByText(/internal_error/i)).toBeInTheDocument();
    });
  });

  it('navigates to story after successful generation', async () => {
    let pollCount = 0;
    vi.stubGlobal(
      'fetch',
      makeFetch(async ({ url, method }) => {
        if (url === '/api/story' && method === 'POST') {
          return { ok: true, data: { id: 'story1' } };
        }
        if (url === '/api/story/story1/run' && method === 'POST') {
          return { ok: true, data: { status: 'READY', model: 'mock-model', settings: {} } };
        }
        if (url === '/api/story/story1') {
          pollCount++;
          return { ok: true, data: { status: 'READY', phase: null } };
        }
        if (url === '/api/story/story1/share' && method === 'POST') {
          return { ok: true, data: { id: 'story1', shareSlug: 'test-slug' } };
        }
        return { ok: true, data: {} };
      })
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    // Advance past the 1500ms poll interval
    await vi.advanceTimersByTimeAsync(1600);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/s/test-slug');
    });
  });

  it('shows error when story status becomes ERROR', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(async ({ url, method }) => {
        if (url === '/api/story' && method === 'POST') {
          return { ok: true, data: { id: 'story1' } };
        }
        if (url === '/api/story/story1/run' && method === 'POST') {
          return { ok: true, data: { status: 'ERROR' } };
        }
        if (url === '/api/story/story1') {
          return { ok: true, data: { status: 'ERROR', phase: null } };
        }
        return { ok: true, data: {} };
      })
    );

    render(<GenerateStoryButton roomCode="TEST" />);
    fireEvent.click(screen.getByRole('button'));

    await vi.advanceTimersByTimeAsync(1600);

    await waitFor(() => {
      expect(screen.getByText(/Generation failed/i)).toBeInTheDocument();
    });
  });
});
