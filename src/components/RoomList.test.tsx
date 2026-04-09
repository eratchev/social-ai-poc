import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoomList from './RoomList';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

type Room = {
  code: string;
  name: string | null;
  createdAt: string;
  _count: { photos: number; stories: number };
};

const twoRooms: Room[] = [
  { code: 'R-ABC', name: 'Summer BBQ', createdAt: '2026-04-08T10:00:00.000Z', _count: { photos: 12, stories: 3 } },
  { code: 'R-XYZ', name: null, createdAt: '2026-04-07T10:00:00.000Z', _count: { photos: 4, stories: 1 } },
];

describe('RoomList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders room names', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('Summer BBQ')).toBeInTheDocument();
  });

  it('renders "Untitled room" for rooms without a name', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('Untitled room')).toBeInTheDocument();
  });

  it('renders room codes', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText('R-ABC')).toBeInTheDocument();
    expect(screen.getByText('R-XYZ')).toBeInTheDocument();
  });

  it('renders photo and story counts', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getByText(/12 photos/i)).toBeInTheDocument();
    expect(screen.getByText(/3 stories/i)).toBeInTheDocument();
  });

  it('renders Open links for each room', () => {
    render(<RoomList rooms={twoRooms} />);
    const links = screen.getAllByRole('link', { name: /open/i });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/u/R-ABC');
    expect(links[1]).toHaveAttribute('href', '/u/R-XYZ');
  });

  it('renders a Delete button for each room', () => {
    render(<RoomList rooms={twoRooms} />);
    expect(screen.getAllByRole('button', { name: /delete room/i })).toHaveLength(2);
  });

  it('shows window.confirm before deleting', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not call fetch when confirm is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('removes room optimistically on successful delete', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) } as any);

    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/rooms/R-ABC', { method: 'DELETE' });
    });

    await waitFor(() => {
      expect(screen.queryByText('Summer BBQ')).not.toBeInTheDocument();
    });
  });

  it('restores room row if delete API fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as any);

    render(<RoomList rooms={twoRooms} />);

    const [firstDeleteBtn] = screen.getAllByRole('button', { name: /delete room/i });
    fireEvent.click(firstDeleteBtn);

    await waitFor(() => {
      expect(screen.getByText('Summer BBQ')).toBeInTheDocument();
    });
  });

  it('renders empty state when rooms list is empty', () => {
    render(<RoomList rooms={[]} />);
    expect(screen.getByText(/no rooms yet/i)).toBeInTheDocument();
  });
});
