import apiClient from './apiClient';
import globals from './globals';
import i18n from '../i18n/config';

/**
 * LT-253: Lighty, the business chat. The server reads the owner's data
 * through its tools and keeps the conversation (30 days); a website request
 * comes back as `handoff`, for the site editor. 429 = the AI budget is spent.
 */
export interface LightyTurn {
  role: 'user' | 'assistant';
  content: string;
  handoff?: string;
  createdAt?: string;
}

const language = () => (i18n.language || 'he').split('-')[0];

export const assistantService = {
  chat: async (message: string): Promise<{ reply: string; handoff?: string }> => {
    const response = await apiClient.post<{ success: boolean; data: { reply: string; handoff?: string } }>(
      `${globals.assistantUrl}chat`,
      { message, language: language() }
    );
    return response.data.data;
  },
  thread: async (): Promise<LightyTurn[]> => {
    const response = await apiClient.get<{ success: boolean; data: LightyTurn[] }>(`${globals.assistantUrl}thread`);
    return response.data.data ?? [];
  },
  clear: async (): Promise<void> => {
    await apiClient.delete(`${globals.assistantUrl}thread`);
  },
};
