import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import HomeLink from './HomeLink';

describe('HomeLink', () => {
  it('renders home link with correct text', () => {
    render(<HomeLink />);
    const link = screen.getByRole('link', { name: /home/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });

  it('renders with home icon', () => {
    render(<HomeLink />);
    const link = screen.getByRole('link');
    expect(link.textContent).toContain('⬅');
  });
});

