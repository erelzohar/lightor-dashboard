/**
 * LT-710: the language follows the user.
 *
 * Which language a person gets when the dashboard (web, or the body of the
 * iPhone/Android apps) starts, strongest first:
 *   1. `?lang=` in the address (a link from the site, the wizard or an email said so);
 *   2. signed in: the account's `defaultLanguage` (AuthContext applies it once
 *      the server answers; not decided here);
 *   3. the person's own earlier pick, the `lt_lang` cookie shared by
 *      lightor.app and its subdomains (missing inside the apps: their origin
 *      is not on lightor.app);
 *   4. the dashboard's own stored choice, `i18nextLng`;
 *   5. the device rule, `languageForDevice`: Hebrew for a Hebrew device and
 *      for any device in Israel that is not Arabic, French or Spanish;
 *      otherwise the device's first language of the five; otherwise English.
 * The same rule and the same names exist in the wizard (lightor-register).
 */
export const SUPPORTED_LANGUAGES = ['en', 'he', 'ar', 'fr', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** The dashboard's own stored choice (the key i18next's detector always used). */
export const STORED_LANGUAGE_KEY = 'i18nextLng';
export const LANGUAGE_COOKIE = 'lt_lang';

const ISRAEL_ZONES = ['Asia/Jerusalem', 'Asia/Tel_Aviv'];

/** One of the five, from a full code ('en-US', 'iw') or anything else; else undefined. */
export const supportedLanguageOf = (value: unknown): SupportedLanguage | undefined => {
  if (typeof value !== 'string') return undefined;
  const two = value.trim().slice(0, 2).toLowerCase();
  const lang = two === 'iw' ? 'he' : two;
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(lang) ? (lang as SupportedLanguage) : undefined;
};

/**
 * The device rule (contract section 1.5). Pure: the device's languages in
 * order (`navigator.languages`) and its time zone are the inputs.
 */
export const languageForDevice = (
  deviceLanguages: readonly string[],
  timeZone: string | undefined,
): SupportedLanguage => {
  const codes = deviceLanguages.map((l) => String(l).trim().slice(0, 2).toLowerCase());
  const first = codes[0];
  if (first === 'he' || first === 'iw') return 'he';
  if (timeZone && ISRAEL_ZONES.includes(timeZone)) {
    return first === 'ar' || first === 'fr' || first === 'es' ? first : 'he';
  }
  for (const code of codes) {
    const lang = supportedLanguageOf(code);
    if (lang) return lang;
  }
  return 'en';
};

/** `?lang=` of a query string, when it is one of the five exactly. */
export const languageFromQuery = (search: string): SupportedLanguage | undefined => {
  try {
    const value = new URLSearchParams(search).get('lang');
    return value && (SUPPORTED_LANGUAGES as readonly string[]).includes(value) ? (value as SupportedLanguage) : undefined;
  } catch {
    return undefined;
  }
};

const onLightorWeb = (): boolean => {
  try {
    if ((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true) {
      return false;
    }
    const host = window.location.hostname;
    return window.location.protocol === 'https:' && (host === 'lightor.app' || host.endsWith('.lightor.app'));
  } catch {
    return false;
  }
};

/**
 * The person picked a language themselves: kept in `lt_lang` for lightor.app,
 * the wizard and the dashboard. Never called for `?lang=` or the device rule.
 */
export const rememberLanguage = (lang: string): void => {
  const value = supportedLanguageOf(lang);
  if (!value || value !== lang) return;
  try {
    const shared = onLightorWeb();
    const attrs = shared
      ? '; Domain=.lightor.app; Path=/; Max-Age=31536000; SameSite=Lax; Secure'
      : `; Path=/; Max-Age=31536000; SameSite=Lax${window.location.protocol === 'https:' ? '; Secure' : ''}`;
    document.cookie = `${LANGUAGE_COOKIE}=${value}${attrs}`;
  } catch {
    // No cookies here (a locked-down browser, an app's WebView): fine.
  }
};

/** The person's own earlier pick from `lt_lang`, when there is a valid one. */
export const rememberedLanguage = (): SupportedLanguage | undefined => {
  try {
    const match = document.cookie.match(/(?:^|;\s*)lt_lang=([^;]*)/);
    const value = match ? decodeURIComponent(match[1]) : '';
    return (SUPPORTED_LANGUAGES as readonly string[]).includes(value) ? (value as SupportedLanguage) : undefined;
  } catch {
    return undefined;
  }
};

export const storedLanguage = (): SupportedLanguage | undefined => {
  try {
    return supportedLanguageOf(window.localStorage.getItem(STORED_LANGUAGE_KEY));
  } catch {
    return undefined;
  }
};

export const storeLanguage = (lang: string): void => {
  const value = supportedLanguageOf(lang);
  if (!value) return;
  try {
    window.localStorage.setItem(STORED_LANGUAGE_KEY, value);
  } catch {
    // Storage blocked: the next start decides again.
  }
};

const deviceLanguages = (): string[] => {
  try {
    const list = navigator.languages?.length ? [...navigator.languages] : [navigator.language];
    return list.filter((l): l is string => typeof l === 'string' && l.length > 0);
  } catch {
    return [];
  }
};

const deviceTimeZone = (): string | undefined => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
};

/**
 * The language the dashboard starts in (sources 1, 3, 4, 5; the account's,
 * source 2, follows when the server says who is signed in). Read when the
 * bundle loads, before the router can redirect away from the address.
 */
let bootLink: SupportedLanguage | undefined;

/**
 * The `?lang=` the dashboard was opened with, if any. It outranks the
 * account's language on that start (contract order: the link first), so the
 * session check does not switch the page away from what the link asked for.
 */
export const linkLanguageAtBoot = (): SupportedLanguage | undefined => bootLink;

export const bootLanguage = (): SupportedLanguage => {
  let search = '';
  try {
    search = window.location.search;
  } catch {
    // no address
  }
  bootLink = languageFromQuery(search);
  return (
    bootLink ??
    rememberedLanguage() ??
    storedLanguage() ??
    languageForDevice(deviceLanguages(), deviceTimeZone())
  );
};

/** The UI language as one of the five (for requests and links). */
export const currentLanguageOf = (lang: string | undefined): SupportedLanguage =>
  supportedLanguageOf(lang) ?? 'he';

/**
 * A two-language page on lightor.app (terms, privacy, accessibility, refund,
 * support, pricing, data deletion): Hebrew first, English at `#english`.
 * A Hebrew UI gets the page as always; any other UI its English part.
 */
export const lightorPageUrl = (
  page: 'terms' | 'privacy' | 'accessibility' | 'refund' | 'support' | 'pricing' | 'data-deletion',
  lang: string | undefined,
): string => `https://lightor.app/${page}.html${currentLanguageOf(lang) === 'he' ? '' : '#english'}`;

/** The signup wizard, in the language this page is in. */
export const registerUrl = (lang: string | undefined): string =>
  `https://register.lightor.app/?lang=${currentLanguageOf(lang)}`;
