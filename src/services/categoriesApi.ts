import apiClient from './apiClient';
import globals from './globals';

/**
 * LT-453: the site categories - the fixed main ones and the sub-categories
 * (the AI adds some), each named in the platform's five languages.
 */
export type CategoryLanguage = 'he' | 'en' | 'ar' | 'fr' | 'es';
export type CategoryNames = Record<CategoryLanguage, string>;

export interface MainCategory {
  key: string;
  names: CategoryNames;
}

export interface SubCategory {
  key: string;
  main: string;
  names: CategoryNames;
}

export interface CategoryList {
  mains: MainCategory[];
  subs: SubCategory[];
}

let cached: Promise<CategoryList> | null = null;

/** The list, read once per page load (a failed read is retried next time). */
export const fetchCategories = (): Promise<CategoryList> => {
  if (!cached) {
    cached = apiClient
      .get<{ data: CategoryList }>(globals.categoriesUrl)
      .then((res) => res.data.data)
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
};

/** Forget the list (after the admin changed it). */
export const forgetCategories = (): void => {
  cached = null;
};

/** A category's name in the UI's language, else English. */
export const categoryName = (names: Partial<CategoryNames> | undefined, language: string): string => {
  const lang = (language || 'he').slice(0, 2) as CategoryLanguage;
  return names?.[lang] || names?.en || '';
};
