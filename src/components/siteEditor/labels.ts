import type { TFunction } from 'i18next';
import { fieldInfo } from '../../utils/editorFields';
import { sectionDef } from '../../utils/editorOptions';

/** A field's name for the owner: "Main title", "Question 2". */
export const fieldLabel = (t: TFunction, path: string): string => {
  const info = fieldInfo(path);
  return t(`siteEditor.fields.${info.label}`, { n: info.n ?? '' });
};

/** A section's name, in Hebrew or English (other UI languages read English). */
export const sectionLabel = (type: string | null | undefined, lang: string): string => {
  const def = sectionDef(type);
  return lang === 'he' ? def.label.he : def.label.en;
};

/** The editor's two-language vocabulary: Hebrew, or English for everyone else. */
export const vocabLang = (language: string | undefined): 'he' | 'en' => ((language || '').startsWith('he') ? 'he' : 'en');
