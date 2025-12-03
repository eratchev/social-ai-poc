import { describe, it, expect } from 'vitest';
import { parseTitleNarrative } from './text';

describe('parseTitleNarrative', () => {
  it('should return default when input is empty', () => {
    const result = parseTitleNarrative('');
    expect(result.title).toBe('Untitled Story');
    expect(result.narrative).toBe('');
  });

  it('should return default when input is null', () => {
    const result = parseTitleNarrative(null as any);
    expect(result.title).toBe('Untitled Story');
    expect(result.narrative).toBe('');
  });

  it('should parse title and narrative from single line', () => {
    const result = parseTitleNarrative('My Story Title');
    expect(result.title).toBe('My Story Title');
    expect(result.narrative).toBe('');
  });

  it('should parse title with "Title:" prefix', () => {
    const result = parseTitleNarrative('Title: My Story');
    expect(result.title).toBe('My Story');
    expect(result.narrative).toBe('');
  });

  it('should parse title with case-insensitive "Title:" prefix', () => {
    const result = parseTitleNarrative('TITLE: My Story');
    expect(result.title).toBe('My Story');
    expect(result.narrative).toBe('');
  });

  it('should parse title and narrative separated by blank line', () => {
    const input = 'My Title\n\nThis is the narrative.';
    const result = parseTitleNarrative(input);
    expect(result.title).toBe('My Title');
    expect(result.narrative).toBe('This is the narrative.');
  });

  it('should parse title and narrative from same block', () => {
    const input = 'My Title\nThis is line one.\nThis is line two.';
    const result = parseTitleNarrative(input);
    expect(result.title).toBe('My Title');
    expect(result.narrative).toBe('This is line one.\nThis is line two.');
  });

  it('should parse complex narrative with multiple paragraphs', () => {
    const input = 'Title: Adventure Begins\n\nFirst paragraph.\n\nSecond paragraph.';
    const result = parseTitleNarrative(input);
    expect(result.title).toBe('Adventure Begins');
    expect(result.narrative).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('should handle title with whitespace', () => {
    const result = parseTitleNarrative('  My Title  ');
    expect(result.title).toBe('My Title');
  });

  it('should handle title with only "Title:" prefix', () => {
    const result = parseTitleNarrative('Title:');
    expect(result.title).toBe('Untitled Story');
  });

  it('should handle narrative without title', () => {
    const input = '\n\nJust narrative here.';
    const result = parseTitleNarrative(input);
    // When first line is empty, it becomes the title
    expect(result.title).toBe('Just narrative here.');
    expect(result.narrative).toBe('');
  });
});

