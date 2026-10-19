import apiClient from './apiClient';
import globals from './globals';
import i18n from '../i18n/config';
import { shrinkImage } from '../lib/ownerImages';
import type { StyleLook } from '../lib/styles';

// LT-052: the AI's chat reply must answer in the language the user is reading
// the dashboard in, not the site's content language (a Hebrew business edited
// by an English-speaking user was getting Hebrew replies). Send the live UI
// language so the backend can bind the reply to it.
const replyLanguage = () => (i18n.language || 'en').split('-')[0];

export interface AiSiteConfig {
  businessName: string;
  logoImageName: string;
  subDomain: string;
  components: {
    hero: { heroImageSrc: string; [k: string]: unknown };
    [k: string]: unknown;
  };
  social?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    [k: string]: string | undefined;
  };
  /** Booking questions the AI proposes (LT-178): no keys, no answers, `services` omitted. */
  bookingFields?: { label: string; type: string; required?: boolean; options?: string[] }[];
  /** The contact form's questions (LT-197), same shape; the edit keeps stored keys (LT-199). */
  leadFields?: { key?: string; label: string; type: string; required?: boolean; options?: string[] }[];
  /** What the site converts to (LT-199); the AI classifies it, the owner can switch it. */
  conversion?: 'book' | 'lead';
  [k: string]: unknown;
}

// LT-052: the backend now lifts the model's conversational reply out of the
// config and returns it alongside. Optional — older responses and degraded
// model outputs simply omit it, and callers fall back to their canned line.
export interface AiChatResult {
  config: AiSiteConfig;
  message?: string;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

// The prior conversation the AI should see. Starts at the first user turn —
// the seeded welcome bubble is client-side i18n text the model never wrote —
// and keeps only the newest 12 turns; the server enforces its own caps on top
// (character budgets), so this only keeps the payload small.
export function trimHistory(msgs: ChatTurn[]): ChatTurn[] {
  const firstUser = msgs.findIndex((m) => m.role === 'user');
  return firstUser === -1 ? [] : msgs.slice(firstUser).slice(-12);
}

const SOCIAL_DEFAULTS: Record<string, string> = {
  instagram: 'https://instagram.com',
  facebook: 'https://facebook.com',
  tiktok: 'https://tiktok.com',
};

function applyDefaultSocials(config: AiSiteConfig): AiSiteConfig {
  if (!config.social) return config;
  const patched = { ...config.social };
  for (const [key, fallback] of Object.entries(SOCIAL_DEFAULTS)) {
    if (!patched[key]) patched[key] = fallback;
  }
  return { ...config, social: patched };
}

// LT-009 transition shim: sessions ride the HttpOnly cookie now; this only
// finds a token on sessions that predate the cookie. Delete by 2027-02.
function getAuthHeaders() {
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// No automatic retries (LT-426, as the register since LT-315): an edit is
// charged before the model runs, so retrying a 500 three times spent the
// owner's AI on one failure and kept them waiting. They see the error and
// decide.
export const aiService = {
  /**
   * The whole-site chat (LT-249). LT-426: up to three of the owner's
   * pictures go as `images`; the server shows them to the AI, which says
   * what each is - a logo, the opening photo, the gallery, a service's
   * picture - and puts each in its place (LT-381).
   */
  editSite: async (
    prompt: string,
    webConfig: AiSiteConfig,
    images: File[] = [],
    history: ChatTurn[] = []
  ): Promise<AiChatResult> => {
    const formData = new FormData();
    formData.append('message', prompt);
    formData.append('webConfig', JSON.stringify(webConfig));
    formData.append('replyLanguage', replyLanguage());
    if (history.length) formData.append('history', JSON.stringify(history));
    for (const image of await Promise.all(images.map(shrinkImage))) formData.append('images', image);

    const response = await apiClient.post<{ success: boolean; data: AiSiteConfig; message?: string }>(
      `${globals.aiUrl}edit`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...getAuthHeaders(),
        },
        withCredentials: true,
      }
    );

    if (!response.data.success) throw new Error('AI edit failed');
    return { config: applyDefaultSocials({ ...response.data.data }), message: response.data.message };
  },

  /**
   * LT-426: the site in another style (the register's try-on, LT-326) - its
   * design and palette as a build in that style draws them. No AI, nothing
   * stored; `designSeed` keeps one site's look the same on every try.
   */
  restyle: async (pallete: unknown, style: string, designSeed: string): Promise<StyleLook> => {
    const response = await apiClient.post<{ success: boolean; data: StyleLook }>(`${globals.aiUrl}restyle`, {
      pallete,
      style,
      designSeed,
      keepPalette: false,
    });
    if (!response.data.success) throw new Error('Restyle failed');
    return response.data.data;
  },

  /**
   * LT-366: one picture made by AI from the owner's words. Answers a
   * temporary URL - the picture is kept when the site is saved. 429 = this
   * month's AI pictures are used up.
   */
  createImage: async (prompt: string, aspect: '16:9' | '4:3' | '1:1'): Promise<string> => {
    const response = await apiClient.post<{ success: boolean; url: string }>(`${globals.aiUrl}image`, { prompt, aspect });
    return response.data.url;
  },

  /**
   * LT-249: the site editor's AI for what the owner selected — one text, or
   * every text of a section. Only these texts can change; the answer carries
   * the ones the model changed, by path. 429 = the AI budget is spent.
   */
  editElement: async (instruction: string, fields: ElementField[]): Promise<ElementEditResult> => {
    const response = await apiClient.post<{ success: boolean; data: ElementEditResult }>(
      `${globals.aiUrl}edit-element`,
      { instruction, fields, language: replyLanguage() }
    );
    return response.data.data;
  },

  /**
   * LT-252: the first draft of a section the site editor adds — written by
   * the server from the site's own facts. 422 = nothing in the draft held,
   * 429 = the AI budget is spent; either way the owner fills it in.
   */
  draftSection: async (type: string): Promise<Record<string, unknown>> => {
    const response = await apiClient.post<{ success: boolean; data: { content: Record<string, unknown> } }>(
      `${globals.aiUrl}section-draft`,
      { type }
    );
    return response.data.data.content;
  },

  /**
   * LT-346: a first draft of a gallery picture's description for screen
   * readers, in the site's language, from the picture itself. Nothing is
   * saved: the owner edits it first. 429 = the AI budget is spent.
   */
  describeImage: async (image: string, language: string): Promise<string> => {
    const response = await apiClient.post<{ success: boolean; data: { alt: string } }>(
      `${globals.aiUrl}image-alt`,
      { image, language }
    );
    return response.data.data.alt;
  },
};

export interface ElementField {
  path: string;
  value: string;
  label?: string;
  maxLength?: number;
}

export interface ElementEditResult {
  values: Record<string, string>;
  message: string;
}
