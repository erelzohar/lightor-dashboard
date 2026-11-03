import type { AxiosError } from 'axios';
import apiClient from './apiClient';
import globals from './globals';
import i18n from '../i18n/config';

/**
 * LT-253: Lighty, the business chat. The server reads the owner's data
 * through its tools and keeps the conversation (30 days); a website request
 * comes back as `handoff`, for the site editor. 429 = the AI budget is spent.
 *
 * LT-561: this dashboard shows action cards (`actionCards: true`), so Lighty
 * may propose changes; each comes back as a card the owner confirms or not,
 * and only the confirm changes anything.
 */
export type LightyActionKind =
  | 'vacation_add' | 'vacation_remove' | 'hours' | 'booking_rules'
  | 'appointment_book' | 'appointment_move' | 'appointment_cancel' | 'appointment_complete'
  | 'lead_status' | 'lead_to_customer' | 'customer_note' | 'customer_block';

/** One line of a card, as the server wrote it from the owner's data. */
export interface LightyActionItem {
  customer?: string;
  service?: string;
  date?: string;
  time?: string;
  newDate?: string;
  newTime?: string;
  newService?: string;
  title?: string;
  from?: string;
  to?: string;
  weekday?: number;
  before?: string | null;
  after?: string | null;
  regular?: boolean;
  rule?: 'cancelUntilMinutes' | 'bookAheadDays';
  was?: number;
  becomes?: number;
  received?: string;
  status?: string;
  previous?: string;
  note?: string;
  reason?: string;
  block?: boolean;
  phone?: string;
}

export type LightyActionStatus = 'pending' | 'running' | 'done' | 'declined' | 'expired' | 'failed' | 'undone';

export interface LightyAction {
  id: string;
  kind: LightyActionKind;
  card: { items: LightyActionItem[]; texts: number; notes: { key: string; count?: number }[] };
  status: LightyActionStatus;
  expiresAt: string;
  undoUntil?: string;
  failure?: 'changed' | 'refused' | 'gone' | 'failed';
  failedItems?: number;
  untold?: number;
}

export interface LightyTurn {
  role: 'user' | 'assistant';
  content: string;
  handoff?: string;
  actions?: LightyAction[];
  createdAt?: string;
}

const language = () => (i18n.language || 'he').split('-')[0];

/** A card's answer: the card as it is now - also when the server says it is closed (409). */
const answer = async (id: string, verb: 'confirm' | 'decline' | 'undo'): Promise<LightyAction> => {
  try {
    const response = await apiClient.post<{ success: boolean; data: LightyAction }>(`${globals.assistantUrl}actions/${id}/${verb}`, {});
    return response.data.data;
  } catch (error) {
    const closed = (error as AxiosError<{ data?: LightyAction }>).response?.data?.data;
    if (closed?.id) return closed;
    throw error;
  }
};

export const assistantService = {
  chat: async (message: string): Promise<{ reply: string; handoff?: string; actions?: LightyAction[] }> => {
    const response = await apiClient.post<{ success: boolean; data: { reply: string; handoff?: string; actions?: LightyAction[] } }>(
      `${globals.assistantUrl}chat`,
      { message, language: language(), actionCards: true }
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
  confirm: (id: string): Promise<LightyAction> => answer(id, 'confirm'),
  decline: (id: string): Promise<LightyAction> => answer(id, 'decline'),
  undo: (id: string): Promise<LightyAction> => answer(id, 'undo'),
};
