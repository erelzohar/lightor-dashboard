import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en.json';
import heTranslations from './locales/he.json';
import arTranslations from './locales/ar.json';
import frTranslations from './locales/fr.json';
import esTranslations from './locales/es.json';

// The five languages the product supports (matches the User.defaultLanguage
// enum on the backend). Right-to-left ones drive the dashboard's direction.
export const SUPPORTED_LANGUAGES = ['en', 'he', 'ar', 'fr', 'es'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
export const RTL_LANGUAGES: SupportedLanguage[] = ['he', 'ar'];
export const isRtlLanguage = (lang?: string): boolean =>
  RTL_LANGUAGES.includes((lang ?? '').split('-')[0] as SupportedLanguage);

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslations },
      he: { translation: heTranslations },
      ar: { translation: arTranslations },
      fr: { translation: frTranslations },
      es: { translation: esTranslations },
    },
    fallbackLng: 'he',
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    // 'en-US' etc. resolve to 'en' rather than falling back to Hebrew.
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
