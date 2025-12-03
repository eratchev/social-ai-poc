import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateFunnyStory } from './story-llm';
import { getStoryProvider } from './ai/providers';

vi.mock('./ai/providers', () => ({
  getStoryProvider: vi.fn(),
}));

describe('story-llm', () => {
  const mockProvider = {
    genBeats: vi.fn(),
    genPanels: vi.fn(),
    genNarrative: vi.fn(),
    providerName: vi.fn(() => 'mock'),
    modelName: vi.fn(() => 'mock-model'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getStoryProvider).mockReturnValue(mockProvider as any);
  });

  it('should generate a story with all steps', async () => {
    const photos = [
      { id: '1', url: 'http://example.com/photo1.jpg' },
      { id: '2', url: 'http://example.com/photo2.jpg' },
    ];

    const mockBeats = [
      { index: 0, type: 'setup' as const, summary: 'Beat 1' },
      { index: 1, type: 'inciting' as const, summary: 'Beat 2' },
    ];

    const mockPanels = [
      { index: 0, photoId: '1', narration: 'Panel 1' },
      { index: 1, photoId: '2', narration: 'Panel 2' },
    ];

    const mockNarrative = {
      title: 'Test Story',
      narrative: 'This is a test narrative.',
    };

    mockProvider.genBeats.mockResolvedValue(mockBeats);
    mockProvider.genPanels.mockResolvedValue(mockPanels);
    mockProvider.genNarrative.mockResolvedValue(mockNarrative);

    const result = await generateFunnyStory({ photos });

    expect(mockProvider.genBeats).toHaveBeenCalledWith({ photos });
    expect(mockProvider.genPanels).toHaveBeenCalledWith({
      beats: mockBeats,
      photos,
      panelCount: 2,
    });
    expect(mockProvider.genNarrative).toHaveBeenCalledWith({
      beats: mockBeats,
      style: undefined,
      wordCount: 200,
    });

    expect(result).toEqual({
      title: 'Test Story',
      narrative: 'This is a test narrative.',
      beatsJson: mockBeats,
      panelMap: mockPanels,
      model: 'mock-model',
      prompt: 'mock',
    });
  });

  it('should pass style parameter', async () => {
    const photos = [{ id: '1', url: 'http://example.com/photo1.jpg' }];
    const style = 'funny';

    mockProvider.genBeats.mockResolvedValue([]);
    mockProvider.genPanels.mockResolvedValue([]);
    mockProvider.genNarrative.mockResolvedValue({
      title: 'Test',
      narrative: 'Narrative',
    });

    await generateFunnyStory({ photos, style });

    expect(mockProvider.genNarrative).toHaveBeenCalledWith({
      beats: [],
      style: 'funny',
      wordCount: 200,
    });
  });
});

