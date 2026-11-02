import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { fetchUsers, SystemMessageAudience } from '../../services/adminApi';

export type FilterKey = 'siteKinds' | 'plans' | 'languages' | 'siteStates';

/** The filters and their values, in the order the picker shows them. */
export const AUDIENCE_FILTERS: Array<{ key: FilterKey; values: string[] }> = [
  { key: 'siteKinds', values: ['book', 'lead', 'catalog'] },
  { key: 'plans', values: ['free', 'trial', 'plus', 'pro', 'lapsed'] },
  { key: 'languages', values: ['he', 'en', 'ar', 'fr', 'es'] },
  { key: 'siteStates', values: ['live', 'notLive'] },
];

/** Unicode isolates: "Lightor+" or a Latin name keeps its own direction inside Hebrew text. */
export const isolate = (text: string): string => `\u2068${text}\u2069`;

/** A language is named in itself, whatever the dashboard's language. */
export const LANGUAGE_NAMES: Record<string, string> = {
  he: 'עברית',
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
};

export interface PickedAccount {
  _id: string;
  name: string;
  email: string;
}

export interface AudienceState {
  mode: 'group' | 'accounts';
  filters: Record<FilterKey, string[]>;
  accounts: PickedAccount[];
  exclude: PickedAccount[];
}

export const emptyAudience = (): AudienceState => ({
  mode: 'group',
  filters: { siteKinds: [], plans: [], languages: [], siteStates: [] },
  accounts: [],
  exclude: [],
});

/** What the API takes: the named accounts in that mode, the filters in the other. */
export const toApiAudience = (state: AudienceState): SystemMessageAudience => {
  const audience: Record<string, string[]> = {};
  if (state.mode === 'accounts') {
    audience.accounts = state.accounts.map((a) => a._id);
  } else {
    for (const { key } of AUDIENCE_FILTERS) if (state.filters[key].length) audience[key] = state.filters[key];
  }
  if (state.exclude.length) audience.exclude = state.exclude.map((a) => a._id);
  return audience as SystemMessageAudience;
};

const chipCls = (on: boolean) =>
  'rounded-full border px-3 py-1 text-sm transition-colors ' +
  (on
    ? 'border-primary bg-primary text-white'
    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-primary');

/** Search for accounts by name, email or business and pick them as chips. */
const AccountSearch: React.FC<{
  label: string;
  picked: PickedAccount[];
  onChange: (update: (prev: PickedAccount[]) => PickedAccount[]) => void;
  testId: string;
}> = ({ label, picked, onChange, testId }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedAccount[] | null>(null);

  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) {
      setResults(null);
      return;
    }
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const page = await fetchUsers({ search, limit: 8 });
        if (live) setResults(page.data.map(({ _id, name, email }) => ({ _id, name, email })));
      } catch {
        if (live) setResults([]);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  const add = (account: PickedAccount) => {
    onChange((prev) => (prev.some((a) => a._id === account._id) ? prev : [...prev, account]));
    setQuery('');
    setResults(null);
  };
  const shown = results?.filter((r) => !picked.some((a) => a._id === r._id));

  return (
    <div data-testid={testId}>
      <label htmlFor={`${testId}-input`} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
      </label>
      {picked.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 mb-2">
          {picked.map((account) => (
            <li
              key={account._id}
              data-testid={`${testId}-chip`}
              className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 ps-3 pe-1 py-0.5 text-sm text-gray-800 dark:text-gray-200"
            >
              <bdi className="break-all">{account.name || account.email}</bdi>
              <button
                type="button"
                onClick={() => onChange((prev) => prev.filter((a) => a._id !== account._id))}
                aria-label={t('admin.messages.audience.remove', { name: account.name || account.email })}
                className="rounded-full p-1 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        id={`${testId}-input`}
        data-testid={`${testId}-input`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('admin.messages.audience.search')}
        autoComplete="off"
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary"
      />
      {shown && (
        <ul className="mt-1 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
          {shown.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">{t('admin.messages.audience.noResults')}</li>
          ) : (
            shown.map((account) => (
              <li key={account._id}>
                <button
                  type="button"
                  onClick={() => add(account)}
                  data-testid={`${testId}-result`}
                  className="w-full text-start px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <span className="text-gray-900 dark:text-dark-text">{account.name}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 break-all" dir="ltr">
                    {account.email}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

/**
 * Who a system message goes to (LT-543): a group by site, plan, language and
 * whether the site is live, or accounts by name; in both, accounts left out.
 */
const AudiencePicker: React.FC<{ value: AudienceState; onChange: React.Dispatch<React.SetStateAction<AudienceState>> }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation();
  // Updates build on the latest state, so taps in quick succession all count.
  const toggle = (key: FilterKey, option: string) =>
    onChange((prev) => {
      const list = prev.filters[key];
      const next = list.includes(option) ? list.filter((v) => v !== option) : [...list, option];
      return { ...prev, filters: { ...prev.filters, [key]: next } };
    });
  const optionLabel = (key: FilterKey, option: string) =>
    key === 'languages' ? LANGUAGE_NAMES[option] : t(`admin.messages.audience.${key}.${option}`);

  return (
    <fieldset className="space-y-4" data-testid="audience-picker">
      <legend className="text-sm font-semibold text-gray-900 dark:text-dark-text">{t('admin.messages.audience.title')}</legend>
      <div className="flex gap-2" role="radiogroup">
        {(['group', 'accounts'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={value.mode === mode}
            onClick={() => onChange((prev) => ({ ...prev, mode }))}
            data-testid={`audience-mode-${mode}`}
            className={chipCls(value.mode === mode)}
          >
            {t(`admin.messages.audience.${mode === 'group' ? 'byGroup' : 'byAccounts'}`)}
          </button>
        ))}
      </div>

      {value.mode === 'group' ? (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.messages.audience.groupHint')}</p>
          {AUDIENCE_FILTERS.map(({ key, values }) => (
            <div key={key}>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t(`admin.messages.audience.${key}.label`)}</p>
              <div className="flex flex-wrap gap-1.5">
                {values.map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={value.filters[key].includes(option)}
                    onClick={() => toggle(key, option)}
                    data-testid={`audience-${key}-${option}`}
                    className={chipCls(value.filters[key].includes(option))}
                  >
                    <bdi>{optionLabel(key, option)}</bdi>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <AccountSearch
          label={t('admin.messages.audience.accountsLabel')}
          picked={value.accounts}
          onChange={(accounts) => onChange((prev) => ({ ...prev, accounts: accounts(prev.accounts) }))}
          testId="audience-accounts"
        />
      )}

      <AccountSearch
        label={t('admin.messages.audience.excludeLabel')}
        picked={value.exclude}
        onChange={(exclude) => onChange((prev) => ({ ...prev, exclude: exclude(prev.exclude) }))}
        testId="audience-exclude"
      />
    </fieldset>
  );
};

export default AudiencePicker;
