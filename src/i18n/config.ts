import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslations from './locales/en.json';
import heTranslations from './locales/he.json';
import arTranslations from './locales/ar.json';
import frTranslations from './locales/fr.json';
import esTranslations from './locales/es.json';
import { SUPPORTED_LANGUAGES, type SupportedLanguage, bootLanguage, storeLanguage } from './language';

// The five languages the product supports (matches the User.defaultLanguage
// enum on the backend). Right-to-left ones drive the dashboard's direction.
export { SUPPORTED_LANGUAGES, type SupportedLanguage };
export const RTL_LANGUAGES: SupportedLanguage[] = ['he', 'ar'];
export const isRtlLanguage = (lang?: string): boolean =>
  RTL_LANGUAGES.includes((lang ?? '').split('-')[0] as SupportedLanguage);

// LT-710: the starting language follows the contract's order (?lang=, the
// lt_lang cookie, the stored choice, the device rule; see language.ts), read
// here, when the bundle loads, before the router can redirect the address.
const initial = bootLanguage();
try {
  document.documentElement.setAttribute('lang', initial);
  document.documentElement.setAttribute('dir', isRtlLanguage(initial) ? 'rtl' : 'ltr');
} catch {
  // no document
}

i18n
  .use(initReactI18next)
  .init({
    lng: initial,
    resources: {
      en: { translation: enTranslations },
      he: { translation: heTranslations },
      ar: { translation: arTranslations },
      fr: { translation: frTranslations },
      es: { translation: esTranslations },
    },
    // LT-710: a key missing in Arabic, French or Spanish shows English before
    // Hebrew; Hebrew (and English) keep falling back as before.
    fallbackLng: { he: ['he'], en: ['he'], default: ['en', 'he'] },
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // 'en-US' etc. resolve to 'en' rather than falling back.
    nonExplicitSupportedLngs: true,
    // The resources are in the bundle: the language is set before the first render.
    initAsync: false,
    interpolation: {
      escapeValue: false,
    },
  });

// Every later change (the account's language once signed in, the owner's
// pick) is the stored choice for the next signed-out start, as the detector's
// cache was. The starting language itself is not stored: a `?lang=` link or
// the device rule must not become a choice the person never made.
i18n.on('languageChanged', (lng) => storeLanguage(lng));

export default i18n;
