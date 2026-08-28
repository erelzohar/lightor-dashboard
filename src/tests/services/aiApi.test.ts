import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
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
      const post = vi.spyOn(axios, 'post').mockResolvedValue(ok);
      const history: ChatTurn[] = [
        { role: 'user', content: 'a nail salon' },
        { role: 'assistant', content: 'Built it.' },
      ];

      await aiService.editSite('make it blue', config, null, history);

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
      const post = vi.spyOn(axios, 'post').mockResolvedValue(ok);

      await aiService.editSite('make it blue', config, null, []);

      expect(sentForm(post).has('history')).toBe(false);
    });

    it('stays backward compatible when the param is not passed at all', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue(ok);

      await aiService.editSite('make it blue', config, null);

      expect(sentForm(post).has('history')).toBe(false);
    });
  });

  describe('generateSite', () => {
    it('appends the history field on onboarding too', async () => {
      const post = vi.spyOn(axios, 'post').mockResolvedValue(ok);
      const history: ChatTurn[] = [{ role: 'user', content: 'first try' }];

      await aiService.generateSite('a barbershop', null, history);

      expect(post).toHaveBeenCalledWith(
        `${globals.aiUrl}onboarding`,
        expect.any(FormData),
        expect.objectContaining({ withCredentials: true })
      );
      const form = sentForm(post);
      expect(JSON.parse(form.get('history') as string)).toEqual(history);
    });
  });
});
