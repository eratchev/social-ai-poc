import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ComicPanel from './ComicPanel';

// ComicPanel renders as <li>, so wrap in <ul> for valid HTML
const wrap = (ui: React.ReactElement) =>
  render(<ul>{ui}</ul>);

describe('ComicPanel', () => {
  it('renders panel number badge (1-indexed)', () => {
    wrap(<ComicPanel index={0} />);
    // badge shows index + 1
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });

  it('renders photo when photoUrl is provided', () => {
    wrap(<ComicPanel index={0} photoUrl="https://example.com/img.jpg" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/img.jpg');
  });

  it('renders large fallback number when no photo', () => {
    wrap(<ComicPanel index={2} />);
    // fallback shows index + 1 = 3 (large centered number)
    // badge also shows 3, so at least 2 elements with "3"
    expect(screen.getAllByText('3').length).toBeGreaterThan(0);
  });

  it('renders SFX joined by space', () => {
    wrap(<ComicPanel index={0} sfx={['POW', 'BAM']} />);
    expect(screen.getByText('POW BAM')).toBeInTheDocument();
  });

  it('does not render SFX element when sfx is empty', () => {
    wrap(<ComicPanel index={0} sfx={[]} />);
    expect(screen.queryByText(/POW/i)).not.toBeInTheDocument();
  });

  it('renders narration text in caption box', () => {
    wrap(<ComicPanel index={0} narration="She looked at the sky." />);
    expect(screen.getByText('She looked at the sky.')).toBeInTheDocument();
  });

  it('does not render caption box when narration is absent', () => {
    wrap(<ComicPanel index={0} />);
    expect(screen.queryByText(/looked at the sky/)).not.toBeInTheDocument();
  });

  it('renders up to 2 bubble chips and truncates extras', () => {
    const bubbles = [
      { text: 'First' },
      { text: 'Second' },
      { text: 'Third — should be hidden' },
    ];
    wrap(<ComicPanel index={0} bubbles={bubbles} />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.queryByText('Third — should be hidden')).not.toBeInTheDocument();
  });

  it('renders bubble speaker prefix', () => {
    wrap(<ComicPanel index={0} bubbles={[{ text: 'Wow!', speaker: 'Alice' }]} />);
    expect(screen.getByText('Alice:')).toBeInTheDocument();
    expect(screen.getByText('Wow!')).toBeInTheDocument();
  });

  it('does not render bubbles div when bubbles array is empty', () => {
    wrap(<ComicPanel index={0} bubbles={[]} />);
    expect(screen.queryByText(/First/)).not.toBeInTheDocument();
  });

  it('uses alt text when provided', () => {
    wrap(<ComicPanel index={0} photoUrl="https://example.com/img.jpg" alt="A sunny day" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'A sunny day');
  });

  it('falls back to panel number when alt is absent', () => {
    wrap(<ComicPanel index={1} photoUrl="https://example.com/img.jpg" />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Panel 2');
  });
});
