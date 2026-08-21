import axios, { type AxiosError } from 'axios';
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
  [k: string]: unknown;
}

// LT-052: the backend now lifts the model's conversational reply out of the
// config and returns it alongside. Optional — older responses and degraded
// model outputs simply omit it, and callers fall back to their canned line.
export interface AiChatResult {
  config: AiSiteConfig;
  message?: string;
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

export const aiService = {
  generateSite: async (prompt: string, logoFile: File | null): Promise<AiChatResult> => {
    const formData = new FormData();
    formData.append('message', prompt);
    formData.append('replyLanguage', replyLanguage());
    if (logoFile) formData.append('logo', logoFile);

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<{ success: boolean; data: AiSiteConfig; message?: string }>(
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

  editSite: async (prompt: string, webConfig: AiSiteConfig, logoFile: File | null): Promise<AiChatResult> => {
    const formData = new FormData();
    formData.append('message', prompt);
    formData.append('webConfig', JSON.stringify(webConfig));
    formData.append('replyLanguage', replyLanguage());
    if (logoFile) formData.append('image', logoFile);

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await axios.post<{ success: boolean; data: AiSiteConfig; message?: string }>(
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
};
