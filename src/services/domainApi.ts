import apiClient from './apiClient';
import globals from './globals';

/**
 * LT-661 (phase 2): the owner's own domain for the site, 1:1 with
 * `/api/domain` - the owner's own site, by the session. Every route answers
 * the same `DomainAnswer`, so an action's answer is the screen's new state.
 * Every function THROWS on failure; `domainErrorKey` turns the server's code
 * into the owner's words, and `domainProofOf` reads the TXT record a taken
 * domain is proven with.
 */

export type DomainStatus = 'pending' | 'active' | 'error' | 'paused';
/** What a pending domain waits for: the owner's DNS record, then the certificate. */
export type DomainStage = 'dns' | 'certificate' | 'active';

export interface DomainState {
  /** As stored: a bare "x.co.il" comes back "www.x.co.il". */
  host: string;
  status: DomainStatus;
  stage: DomainStage;
  /** The server's last reason, short and in English: never shown as it is. */
  error?: string;
  connectedAt?: string;
  checkedAt?: string;
  activeAt?: string;
  pausedAt?: string;
  /** Pending: when an unconnected domain is released. Paused: when it is removed. */
  expiresAt?: string;
}

export interface DomainAnswer {
  /** False: the server has no Cloudflare token, and the row stays "coming soon". */
  configured: boolean;
  /** The plan has it (Lightor+ and Pro, the free days too). */
  allowed: boolean;
  /** What the owner's CNAME record points at. */
  target: string;
  domain: DomainState | null;
}

/** The TXT record that proves a domain another site holds is this owner's. */
export interface DomainProof {
  name: string;
  value: string;
}

const URL = globals.domainUrl;

/** The state as stored (the server asks Cloudflare nothing here). */
export const fetchDomain = async (): Promise<DomainAnswer> => (await apiClient.get(URL)).data.data;

/** Connects the domain as typed; the answer's `domain.host` is the name that was stored. */
export const connectDomain = async (host: string): Promise<DomainAnswer> => (await apiClient.put(URL, { host })).data.data;

/** Asks Cloudflare again: pending or error becomes active, and back. */
export const checkDomain = async (): Promise<DomainAnswer> => (await apiClient.post(`${URL}/check`)).data.data;

/** Disconnects; the answer carries `domain: null`. Allowed on any plan. */
export const disconnectDomain = async (): Promise<DomainAnswer> => (await apiClient.delete(URL)).data.data;

interface Refusal {
  response?: { status?: number; data?: { code?: unknown; proof?: unknown } };
}

/** The server's code for a refusal (`{ success: false, error, code }`), if it sent one. */
export const domainErrorCode = (error: unknown): string | undefined => {
  const code = (error as Refusal)?.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
};

/** The HTTP status of a refusal; undefined when the server was not reached. */
export const domainErrorStatus = (error: unknown): number | undefined => (error as Refusal)?.response?.status;

// The codes the domain routes answer with (the contract's list).
const CODES = new Set([
  'INVALID_DOMAIN',
  'DOMAIN_TAKEN',
  'PLAN_REQUIRED',
  'TOO_MANY',
  'CLOUDFLARE_REFUSED',
  'CLOUDFLARE_UNREACHABLE',
  'DOMAINS_NOT_CONFIGURED',
  'NO_SITE',
]);

/**
 * The translation key for a refusal: the code's own text, else a general one.
 * The server's English `error` is never shown.
 */
export const domainErrorKey = (error: unknown): string => {
  const code = domainErrorCode(error);
  return `settings.customDomain.errors.${code && CODES.has(code) ? code : 'generic'}`;
};

/** A 409 DOMAIN_TAKEN's proof record, when the server sent a whole one. */
export const domainProofOf = (error: unknown): DomainProof | null => {
  if (domainErrorCode(error) !== 'DOMAIN_TAKEN') return null;
  const proof = (error as Refusal)?.response?.data?.proof as Partial<DomainProof> | undefined;
  return proof && typeof proof.name === 'string' && proof.name && typeof proof.value === 'string' && proof.value
    ? { name: proof.name, value: proof.value }
    : null;
};
