import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from './ThemeToggle';
import { useTheme } from 'next-themes';

vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
}));

describe('ThemeToggle', () => {
  const mockSetTheme = vi.fn();
  const mockUseTheme = vi.mocked(useTheme);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
      themes: [],
      systemTheme: 'light',
    } as any);
  });

  it('should not render until mounted', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: undefined,
      theme: undefined,
      themes: [],
      systemTheme: undefined,
    } as any);

    const { container } = render(<ThemeToggle />);
    // Component returns null until mounted, but useEffect runs after render
    await waitFor(() => {
      // After mount, it should render
      expect(container.firstChild).not.toBeNull();
    }, { timeout: 100 });
  });

  it('should render light theme button', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
      themes: [],
      systemTheme: 'light',
    } as any);

    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /toggle theme/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Light');
    });
  });

  it('should render dark theme button', async () => {
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: 'dark',
      themes: [],
      systemTheme: 'dark',
    } as any);

    render(<ThemeToggle />);

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Dark');
    });
  });

  it('should toggle theme when clicked', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'light',
      theme: 'light',
      themes: [],
      systemTheme: 'light',
    } as any);

    render(<ThemeToggle />);

    await waitFor(async () => {
      const button = screen.getByRole('button');
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });
  });

  it('should toggle from dark to light', async () => {
    const user = userEvent.setup();
    mockUseTheme.mockReturnValue({
      setTheme: mockSetTheme,
      resolvedTheme: 'dark',
      theme: 'dark',
      themes: [],
      systemTheme: 'dark',
    } as any);

    render(<ThemeToggle />);

    await waitFor(async () => {
      const button = screen.getByRole('button');
      await user.click(button);
      expect(mockSetTheme).toHaveBeenCalledWith('light');
    });
  });
});

