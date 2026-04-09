import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomNameEditor from './RoomNameEditor';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('RoomNameEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders room name in idle state', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
  });

  it('falls back to "Room ABC" when name is null', () => {
    render(<RoomNameEditor roomCode="ABC" initialName={null} />);
    expect(screen.getByText('Room ABC')).toBeInTheDocument();
  });

  it('clicking pencil button enters edit mode with input pre-filled', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('My Room');
  });

  it('input is empty when name is null and pencil is clicked', () => {
    render(<RoomNameEditor roomCode="ABC" initialName={null} />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('Escape key cancels and returns to idle with previous name', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Cancel button restores previous name', () => {
    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.getByText('My Room')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('Save button calls PATCH with trimmed name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC', name: 'New Name' }),
    } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '  New Name  ' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/ABC', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New Name' }),
      });
    });

    await waitFor(() => {
      expect(screen.getByText('New Name')).toBeInTheDocument();
    });
  });

  it('Enter key saves the name', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'ABC', name: 'New Name' }),
    } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/ABC', expect.any(Object));
    });
  });

  it('input is disabled while saving', async () => {
    let resolveFetch!: (v: unknown) => void;
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();

    await act(async () => {
      resolveFetch({ ok: true, json: async () => ({ code: 'ABC', name: 'New Name' }) });
    });
  });

  it('restores previous name when PATCH fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<RoomNameEditor roomCode="ABC" initialName="My Room" />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'New Name' } });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText('My Room')).toBeInTheDocument();
    });
  });
});
