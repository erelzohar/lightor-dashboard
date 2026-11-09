import { describe, it, expect, beforeAll } from 'vitest';
import i18n from '../../i18n/config';
import { weeklyLimitMessage } from '../../utils/accountPace';

/** LT-633: one new account a week per person; the refusal names the day and hour it opens again. */
describe('weeklyLimitMessage', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('en');
  });

  it('names the day and hour from the server, in Israel time', () => {
    const err = { response: { data: { code: 'ACCOUNT_WEEKLY_LIMIT', details: { retryAt: '2026-11-16T16:30:00.000Z' } } } };
    const text = weeklyLimitMessage(err, i18n.t.bind(i18n), 'en');
    expect(text).toMatch(/once a week/);
    expect(text).toMatch(/16/);
    expect(text).toMatch(/18:30|6:30/);
  });

  it('leaves every other error alone', () => {
    expect(weeklyLimitMessage({ response: { data: { code: 'APPLE_NO_EMAIL' } } }, i18n.t.bind(i18n), 'en')).toBeNull();
    expect(weeklyLimitMessage(new Error('x'), i18n.t.bind(i18n), 'en')).toBeNull();
  });
});

describe('weeklyLimitMessage, as the account update passes the refusal on', () => {
  it('reads the code and details off the error itself', async () => {
    await i18n.changeLanguage('en');
    const err = Object.assign(new Error('A new account can be opened once a week'), { code: 'ACCOUNT_WEEKLY_LIMIT', details: { retryAt: '2026-11-16T16:30:00.000Z' } });
    expect(weeklyLimitMessage(err, i18n.t.bind(i18n), 'en')).toMatch(/once a week/);
    expect(weeklyLimitMessage(Object.assign(new Error('x'), { code: 'PHONE_ACCOUNT_LIMIT' }), i18n.t.bind(i18n), 'en')).toBeNull();
  });
});
