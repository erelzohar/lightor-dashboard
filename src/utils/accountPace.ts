/**
 * LT-633 (Erel 2026-11-09): one new account a week per person, and a week's
 * wait after deleting one. The server's refusal, in the owner's words with the
 * day and hour it opens again, or null for any other error. The caller hands
 * in its own `t` and language, so this file loads no i18n of its own.
 */
type Refusal = { code?: string; details?: { retryAt?: string } };
type T = (key: string, options?: Record<string, unknown>) => string;

export const weeklyLimitMessage = (err: unknown, t: T, language: string): string | null => {
  // The API's answer as axios has it, or as userApi passes it on (code and details).
  const e = err as ({ response?: { data?: Refusal } } & Refusal) | null | undefined;
  const data: Refusal | undefined = e?.response?.data ?? (e?.code ? e : undefined);
  if (data?.code !== 'ACCOUNT_WEEKLY_LIMIT') return null;
  const at = data.details?.retryAt ? new Date(data.details.retryAt) : null;
  const when = at && !Number.isNaN(at.getTime())
    ? at.toLocaleString(language || 'he', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' })
    : '';
  return t('login.weeklyLimit', {
    when,
    defaultValue: 'A new account can be opened once a week. You can open one again from {{when}}.',
  });
};
