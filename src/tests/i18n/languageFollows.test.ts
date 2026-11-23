import { describe, it, expect, vi, afterEach } from 'vitest';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import i18n from '../../i18n/config';
import { googleLogin, googleLoginWithIdToken, facebookLogin } from '../../services/authApi';
import {
  bootLanguage,
  languageForDevice,
  languageFromQuery,
  lightorPageUrl,
  linkLanguageAtBoot,
  registerUrl,
  rememberLanguage,
  rememberedLanguage,
} from '../../i18n/language';
import { stubLocation } from '../helpers/location';

/**
 * LT-710: the language follows the user. The contract's device rule (the
 * same table in the wizard), the boot order (?lang=, the lt_lang cookie, the
 * stored choice, the device), the cookie, the links that leave the
 * dashboard, and the language every social sign-in carries.
 */
describe('languageForDevice (the contract table)', () => {
  it.each([
    [['he-IL'], 'America/New_York', 'he'],
    [['en-US'], 'Asia/Jerusalem', 'he'],
    [['ar'], 'Asia/Jerusalem', 'ar'],
    [['fr-FR'], 'Asia/Jerusalem', 'fr'],
    [['ru-RU'], 'Asia/Jerusalem', 'he'],
    [['en-US'], 'America/New_York', 'en'],
    [['es-US', 'en-US'], 'America/Chicago', 'es'],
    [['de-DE', 'fr-FR'], 'Europe/Berlin', 'fr'],
    [['de-DE'], 'Europe/Berlin', 'en'],
    [['iw-IL'], 'Europe/London', 'he'],
    [[], 'UTC', 'en'],
    // Beyond the table: the old Israeli zone name, and Spanish in Tel Aviv.
    [['en-GB'], 'Asia/Tel_Aviv', 'he'],
    [['es-ES'], 'Asia/Tel_Aviv', 'es'],
  ])('%j in %s gets %s', (langs, zone, expected) => {
    expect(languageForDevice(langs, zone)).toBe(expected);
  });
});

const clearCookie = () => {
  document.cookie = 'lt_lang=; Path=/; Max-Age=0';
};

const device = (languages: string[], timeZone: string) => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({ resolvedOptions: () => ({ timeZone }) } as unknown as Intl.DateTimeFormat);
};

describe('the language the dashboard starts in', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearCookie();
  });

  it('a device outside the five, outside Israel, starts in English (it was Hebrew)', () => {
    device(['de-DE'], 'Europe/Berlin');
    expect(bootLanguage()).toBe('en');
  });

  it('an English device in Israel starts in Hebrew; in New York in English', () => {
    device(['en-US'], 'Asia/Jerusalem');
    expect(bootLanguage()).toBe('he');
    device(['en-US'], 'America/New_York');
    expect(bootLanguage()).toBe('en');
  });

  it('the stored choice beats the device; the cookie beats the stored choice; ?lang= beats them all', () => {
    device(['en-US'], 'America/New_York');
    localStorage.setItem('i18nextLng', 'he');
    expect(bootLanguage()).toBe('he');
    document.cookie = 'lt_lang=ar; Path=/';
    expect(bootLanguage()).toBe('ar');
    expect(linkLanguageAtBoot()).toBeUndefined();
    stubLocation('http://localhost/login?lang=fr');
    expect(bootLanguage()).toBe('fr');
    expect(linkLanguageAtBoot()).toBe('fr');
  });

  it('?lang= is read whole, on any page, beside other parameters; anything else is ignored', () => {
    expect(languageFromQuery('?token=abc&lang=es')).toBe('es');
    expect(languageFromQuery('?lang=EN')).toBeUndefined();
    expect(languageFromQuery('?lang=de')).toBeUndefined();
    expect(languageFromQuery('')).toBeUndefined();
  });
});

describe('the lt_lang cookie', () => {
  afterEach(clearCookie);

  it('keeps one of the five and reads it back; nothing else is written', () => {
    expect(rememberedLanguage()).toBeUndefined();
    rememberLanguage('es');
    expect(rememberedLanguage()).toBe('es');
    rememberLanguage('de');
    rememberLanguage('en-US');
    expect(rememberedLanguage()).toBe('es');
  });

  it('a cookie with a value outside the five is ignored', () => {
    document.cookie = 'lt_lang=ru; Path=/';
    expect(rememberedLanguage()).toBeUndefined();
  });

  it('starting the dashboard never writes it (not from ?lang=, not from the device)', () => {
    stubLocation('http://localhost/login?lang=fr');
    bootLanguage();
    expect(rememberedLanguage()).toBeUndefined();
  });
});

describe('links that leave the dashboard', () => {
  it('the wizard opens in the dashboard language', () => {
    expect(registerUrl('en')).toBe('https://register.lightor.app/?lang=en');
    expect(registerUrl('he')).toBe('https://register.lightor.app/?lang=he');
  });

  it('a Hebrew UI gets the legal page as always; any other its English part', () => {
    expect(lightorPageUrl('terms', 'he')).toBe('https://lightor.app/terms.html');
    expect(lightorPageUrl('privacy', 'fr')).toBe('https://lightor.app/privacy.html#english');
    expect(lightorPageUrl('refund', 'ar')).toBe('https://lightor.app/refund.html#english');
    expect(lightorPageUrl('accessibility', 'en')).toBe('https://lightor.app/accessibility.html#english');
  });
});

describe('the stored choice', () => {
  it('a later change (the account, the owner) is stored for the next start', async () => {
    await i18n.changeLanguage('es');
    expect(localStorage.getItem('i18nextLng')).toBe('es');
  });

  it('a missing key falls back to English before Hebrew, except in Hebrew', () => {
    expect(i18n.services.languageUtils.getFallbackCodes(i18n.options.fallbackLng, 'fr')).toEqual(['en', 'he']);
    expect(i18n.services.languageUtils.getFallbackCodes(i18n.options.fallbackLng, 'he')).toEqual(['he']);
    expect(i18n.services.languageUtils.getFallbackCodes(i18n.options.fallbackLng, 'en')).toEqual(['he']);
  });
});

describe('every social sign-in carries the UI language (LT-710)', () => {
  afterEach(() => vi.restoreAllMocks());
  const ok = { data: { success: true, token: 'jwt', data: { _id: 'u1' } } };

  it('Google on the web (access token) and in the apps (ID token)', async () => {
    await i18n.changeLanguage('en');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok as never);
    await googleLogin('access-1');
    await googleLoginWithIdToken('id-1');
    expect(post).toHaveBeenNthCalledWith(1, `${globals.authUrl}google`, { token: 'access-1', defaultLanguage: 'en' }, { withCredentials: true });
    expect(post).toHaveBeenNthCalledWith(2, `${globals.authUrl}google`, { idToken: 'id-1', defaultLanguage: 'en' }, { withCredentials: true });
  });

  it('Facebook, the web access token and the iPhone ID token alike', async () => {
    await i18n.changeLanguage('ar');
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(ok as never);
    await facebookLogin({ accessToken: 'fb-1' });
    await facebookLogin({ idToken: 'fb.jwt', nonce: 'n' });
    expect(post).toHaveBeenNthCalledWith(1, `${globals.authUrl}facebook`, { accessToken: 'fb-1', defaultLanguage: 'ar' }, { withCredentials: true });
    expect(post).toHaveBeenNthCalledWith(2, `${globals.authUrl}facebook`, { idToken: 'fb.jwt', nonce: 'n', defaultLanguage: 'ar' }, { withCredentials: true });
  });
});
