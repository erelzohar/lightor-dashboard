import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import { aiService, trimHistory, type AiSiteConfig, type ChatTurn } from '../../services/aiApi';
import globals from '../../services/globals';

/**
 * Conversation history: the AI builder replays the chat thread as an optional
 * `history` form field so the model can resolve "undo that" / "like before".
 * The seeded welcome bubble is client-side i18n text the model never wrote —
 * it must never be attributed to the model, so history starts at the first
 * user turn (and an empty result must omit the field entirely).
 */
describe('aiApi conversation history', () => {
  const config = { businessName: 'Nails' } as AiSiteConfig;
  const ok = { data: { success: true, data: { businessName: 'Nails' }, message: 'done' } } as never;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const sentForm = (post: ReturnType<typeof vi.spyOn>): FormData =>
    post.mock.calls[0][1] as FormData;

  describe('trimHistory', () => {
    const welcome: ChatTurn = { role: 'assistant', content: 'Welcome! Tell me about your business.' };

    it('starts at the first user turn, dropping the seeded welcome', () => {
      const thread: ChatTurn[] = [
        welcome,
        { role: 'user', content: 'a nail salon' },
        { role: 'assistant', content: 'Built it.' },
      ];
      expect(trimHistory(thread)).toEqual(thread.slice(1));
    });

    it('returns [] for a welcome-only thread', () => {
      expect(trimHistory([welcome])).toEqual([]);
      expect(trimHistory([])).toEqual([]);
    });

    it('keeps only the newest 12 turns', () => {
      const thread: ChatTurn[] = Array.from({ length: 20 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i}`,
      }));
      const trimmed = trimHistory(thread);
      expect(trimmed).toHaveLength(12);
      expect(trimmed[0].content).toBe('turn 8');
      expect(trimmed[11].content).toBe('turn 19');
    });
  });

  describe('editSite', () => {
    it('appends the trimmed thread as a history JSON field', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok);
      const history: ChatTurn[] = [
        { role: 'user', content: 'a nail salon' },
        { role: 'assistant', content: 'Built it.' },
      ];

      await aiService.editSite('make it blue', config, [], history);

      expect(post).toHaveBeenCalledWith(
        `${globals.aiUrl}edit`,
        expect.any(FormData),
        expect.objectContaining({ withCredentials: true })
      );
      const form = sentForm(post);
      expect(form.get('message')).toBe('make it blue');
      expect(JSON.parse(form.get('history') as string)).toEqual(history);
    });

    it('omits the history field when there are no prior turns', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok);

      await aiService.editSite('make it blue', config, [], []);

      expect(sentForm(post).has('history')).toBe(false);
    });

    it('stays backward compatible when the param is not passed at all', async () => {
      const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok);

      await aiService.editSite('make it blue', config);

      expect(sentForm(post).has('history')).toBe(false);
    });
  });

  // LT-426: the owner's pictures, as the register sends them (LT-381).
  it('sends the pictures as `images`, one field each', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok);
    const a = new File([new Uint8Array(1)], 'a.png', { type: 'image/png' });
    const b = new File([new Uint8Array(1)], 'b.jpg', { type: 'image/jpeg' });

    await aiService.editSite('put these on the site', config, [a, b]);

    const form = sentForm(post);
    expect(form.getAll('images').map((f) => (f as File).name)).toEqual(['a.png', 'b.jpg']);
    expect(form.has('image')).toBe(false);
  });

  // LT-426: an edit is charged before the model runs; one failure is one try.
  it('never retries a failed edit', async () => {
    const post = vi.spyOn(apiClient, 'post').mockRejectedValue({ response: { status: 500 } });

    await expect(aiService.editSite('make it blue', config)).rejects.toEqual({ response: { status: 500 } });
    expect(post).toHaveBeenCalledTimes(1);
  });

  // LT-426: the register's style try-on, on the owner's own site.
  it('asks the server for a style look with the site palette and seed', async () => {
    const look = { design: { stylePreset: 'serene' }, pallete: { colorLightBg: '#f5f0e8' } };
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { success: true, data: look } } as never);

    await expect(aiService.restyle({ colorPrimary: '#111111' }, 'serene', 'site-1')).resolves.toEqual(look);
    expect(post).toHaveBeenCalledWith(`${globals.aiUrl}restyle`, { pallete: { colorPrimary: '#111111' }, style: 'serene', designSeed: 'site-1', keepPalette: false });
  });
});
