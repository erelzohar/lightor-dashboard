import { type AxiosError } from 'axios';
import apiClient from './apiClient';
import globals from './globals';
import i18n from '../i18n/config';

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
  });
}

// LT-009 transition shim: sessions ride the HttpOnly cookie now; this only
// finds a token on sessions that predate the cookie. Delete by 2027-02.
function getAuthHeaders() {
  const token = localStorage.getItem('lightor');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const MAX_RETRIES = 3;

// LT-103: one random seed per builder CONVERSATION drives the server's design
// rotation (preset family, hero layout, background, image set) — same
// contract as the register app. Without it the server seeded off business
// name + message, so regenerating similar text converged on the same look.
let currentDesignSeed: string | null = null;

const mintDesignSeed = (): string =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const aiService = {
  generateSite: async (
    prompt: string,
    logoFile: File | null,
    history: ChatTurn[] = []
  ): Promise<AiChatResult> => {
    const formData = new FormData();
    formData.append('message', prompt);
    formData.append('replyLanguage', replyLanguage());
    if (history.length) formData.append('history', JSON.stringify(history));
    if (logoFile) formData.append('logo', logoFile);
    // Fresh conversation → fresh seed; follow-up turns reuse it.
    if (!history.length || !currentDesignSeed) currentDesignSeed = mintDesignSeed();
    formData.append('designSeed', currentDesignSeed);

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await apiClient.post<{ success: boolean; data: AiSiteConfig; message?: string }>(
          `${globals.aiUrl}onboarding`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
              ...getAuthHeaders(),
            },
            withCredentials: true,
          }
        );

        if (!response.data.success) throw new Error('AI generation failed');

        let config = applyDefaultSocials({ ...response.data.data });

        if (logoFile) {
          try {
            const logoBase64 = await fileToBase64(logoFile);
            config.logoImageName = logoBase64;
            config = {
              ...config,
              components: {
                ...config.components,
                hero: { ...config.components.hero, heroImageSrc: logoBase64 },
              },
            };
          } catch {
            // non-fatal
          }
        }

        return { config, message: response.data.message };
      } catch (err) {
        const status = (err as AxiosError)?.response?.status;
        if (status === 500 && attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  },

  editSite: async (
    prompt: string,
    webConfig: AiSiteConfig,
    logoFile: File | null,
    history: ChatTurn[] = []
  ): Promise<AiChatResult> => {
    const formData = new FormData();
    formData.append('message', prompt);
    formData.append('webConfig', JSON.stringify(webConfig));
    formData.append('replyLanguage', replyLanguage());
    if (history.length) formData.append('history', JSON.stringify(history));
    if (logoFile) formData.append('image', logoFile);

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
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

        let config = applyDefaultSocials({ ...response.data.data });

        if (logoFile) {
          try {
            const logoBase64 = await fileToBase64(logoFile);
            config.logoImageName = logoBase64;
            config = {
              ...config,
              components: {
                ...config.components,
                hero: { ...config.components.hero, heroImageSrc: logoBase64 },
              },
            };
          } catch {
            // non-fatal
          }
        }

        return { config, message: response.data.message };
      } catch (err) {
        const status = (err as AxiosError)?.response?.status;
        if (status === 500 && attempt < MAX_RETRIES) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError;
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
