import React from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { copyText } from '../../utils/copyText';
import type { DomainProof } from '../../services/domainApi';

/**
 * LT-661 (phase 2): what the owner types at the domain's registrar, with a
 * copy button on every value. Names and values read left to right inside any
 * language, and a long one wraps: nothing is cut.
 */

const P = 'settings.customDomain';

/** One thing to paste: its label, the value, and (unless it is fixed text like "CNAME") a copy button. */
const RecordRow: React.FC<{ id: string; label: string; value: string; copy?: boolean }> = ({ id, label, value, copy = true }) => {
  const { t } = useTranslation();
  const onCopy = async () => {
    if (await copyText(value)) toast.success(t(`${P}.copied`));
    else toast.error(t(`${P}.copyFailed`));
  };
  return (
    // A phone puts the label over the value, so a name like "sites.lightor.app" stays on one line.
    <div className="py-2 sm:flex sm:items-start sm:gap-3">
      <dt className="sm:w-16 sm:shrink-0 sm:pt-0.5 text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-0.5 sm:mt-0 min-w-0 flex-1 flex items-start justify-between gap-2">
        <code dir="ltr" className="min-w-0 font-mono text-[0.8125rem] leading-6 text-gray-900 dark:text-gray-100 break-all text-start" data-testid={`domain-value-${id}`}>
          {value}
        </code>
        {copy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={t(`${P}.copyOf`, { what: label })}
            title={t(`${P}.copy`)}
            className="shrink-0 -my-1 p-2 rounded-lg text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-colors"
            data-testid={`domain-copy-${id}`}
          >
            <Copy className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </dd>
    </div>
  );
};

const rows = 'divide-y divide-gray-200/70 dark:divide-gray-700/50 rounded-lg border border-gray-200/70 dark:border-gray-700/50 bg-white/70 dark:bg-white/[0.03] px-3';

/** The menus as the registrars name them (their own screens, in English). */
const path = (...steps: string[]) => steps.join(' > ');

interface DomainRecordsProps {
  /** The connected host, as the server stored it: "www.dana-studio.co.il". */
  host: string;
  /** What the CNAME points at: "sites.lightor.app". */
  target: string;
}

/**
 * The instructions for a connected host: (1) the CNAME record, its name the
 * host's first label; (2) for a `www` host, forwarding the bare domain to it;
 * then where the registrars keep these screens.
 */
export const DomainRecords: React.FC<DomainRecordsProps> = ({ host, target }) => {
  const { t } = useTranslation();
  const [first, ...rest] = host.split('.');
  // The domain as it was bought; only a `www` host has a bare one to forward.
  const bare = rest.join('.');
  const forwards = first === 'www' && rest.length >= 2;

  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-700/60 bg-gray-50/60 dark:bg-white/[0.02] p-3 sm:p-4 space-y-4" data-testid="domain-records">
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t(`${P}.records.title`)}</p>
      {/* The numbers are written out, not list markers: the boxes keep the card's whole width. */}
      <ol className="space-y-4">
        <li>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">1. {t(`${P}.records.step1`)}</p>
          <dl className={`mt-2 ${rows}`}>
            <RecordRow id="type" label={t(`${P}.records.type`)} value="CNAME" copy={false} />
            <RecordRow id="name" label={t(`${P}.records.name`)} value={first || 'www'} />
            <RecordRow id="target" label={t(`${P}.records.value`)} value={target} />
          </dl>
        </li>
        {forwards && (
          <li>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">2. {t(`${P}.records.step2`, { domain: bare })}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">{t(`${P}.records.step2Body`, { domain: bare })}</p>
            <dl className={`mt-2 ${rows}`}>
              <RecordRow id="forward" label={t(`${P}.records.forwardTo`)} value={`https://${host}`} />
            </dl>
          </li>
        )}
      </ol>
      <p className="text-xs text-gray-600 dark:text-gray-300">{t(`${P}.records.mail`)}</p>

      <div className="border-t border-gray-200/70 dark:border-gray-700/50 pt-3 space-y-2 text-xs text-gray-600 dark:text-gray-300" data-testid="domain-guide">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{t(`${P}.records.guideTitle`)}</p>
        <p>{t(`${P}.records.guideGeneral`)}</p>
        <ul className="space-y-2">
          {[
            {
              name: 'GoDaddy',
              record: path('My Products', forwards ? bare : host, 'DNS', 'Add New Record'),
              forward: path('DNS', 'Forwarding'),
            },
            {
              name: 'Namecheap',
              record: path('Domain List', 'Manage', 'Advanced DNS', 'Add New Record'),
              forward: path('Domain', 'Redirect Domain'),
            },
          ].map((registrar) => (
            <li key={registrar.name}>
              <p className="font-medium text-gray-800 dark:text-gray-100">
                <bdi>{registrar.name}</bdi>
              </p>
              <p>
                {t(`${P}.records.guideRecord`)} <bdi dir="ltr" className="break-words">{registrar.record}</bdi>
              </p>
              {forwards && (
                <p>
                  {t(`${P}.records.guideForward`)} <bdi dir="ltr" className="break-words">{registrar.forward}</bdi>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/**
 * A domain another Lightor site holds (409 DOMAIN_TAKEN with `proof`): the
 * TXT record that proves it is this owner's. Once it is at the registrar,
 * pressing Connect again moves the domain here.
 */
export const DomainProofCard: React.FC<{ proof: DomainProof }> = ({ proof }) => {
  const { t } = useTranslation();
  // `_lightor.www.x.co.il`: most registrars take the name without the domain
  // (`_lightor.www`), some the whole of it - both are here to copy.
  const host = proof.name.replace(/^_lightor\./, '');
  const short = `_lightor.${host.split('.')[0]}`;
  return (
    <div
      className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 p-3 sm:p-4 space-y-3"
      data-testid="domain-proof"
    >
      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t(`${P}.proof.title`)}</p>
      <p className="text-sm text-gray-700 dark:text-gray-200">{t(`${P}.proof.body`)}</p>
      <dl className={rows}>
        <RecordRow id="proof-type" label={t(`${P}.records.type`)} value="TXT" copy={false} />
        <RecordRow id="proof-name" label={t(`${P}.records.name`)} value={short} />
        <RecordRow id="proof-value" label={t(`${P}.records.value`)} value={proof.value} />
      </dl>
      <div className="text-xs text-gray-600 dark:text-gray-300">
        <p>{t(`${P}.proof.fullName`)}</p>
        <dl className={`mt-2 ${rows}`}>
          <RecordRow id="proof-full-name" label={t(`${P}.records.name`)} value={proof.name} />
        </dl>
      </div>
    </div>
  );
};
