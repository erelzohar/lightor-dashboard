import React from 'react';
import { Check, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { AppointmentAnswer, BookingField, BookingFieldType } from '../../types';
import { useAppSelector } from '../../hooks/useAppSelector';
import { CONFIRM_YES, addressKeys, compactAnswer, mapsSearchUrl } from '../../utils/bookingFields';

interface AnswersListProps {
  answers?: AppointmentAnswer[];
  /**
   * The catalog the answers were asked from, used to tell an address (maps
   * link) and a confirm (tick) from plain text. Defaults to the saved config;
   * an answer to a since-deleted question falls back to `label: value`.
   */
  fields?: BookingField[];
  /** One line for a list row: the address if there is one, else the first answer. */
  compact?: boolean;
  className?: string;
}

const WRAP = 'break-words [overflow-wrap:anywhere] whitespace-pre-wrap';

/**
 * A customer's answers to the booking questions (LT-178), wherever an
 * appointment shows: the calendar popup, the details modal, the list rows and
 * the session roster. Labels are the owner's own words, copied onto the
 * appointment when it was booked, so they render raw. Renders nothing when
 * there is nothing to show. An address is the whole point for a home visit,
 * so it is a Google Maps link and is never truncated.
 */
const AnswersList: React.FC<AnswersListProps> = ({ answers, fields, compact = false, className = '' }) => {
  const { t } = useTranslation();
  const storedFields = useAppSelector((s) => s.webConfig.data?.bookingFields);
  const catalog = fields ?? storedFields;

  if (!answers?.length) return null;

  const addresses = addressKeys(catalog);
  const typeOf = (key: string): BookingFieldType | undefined =>
    catalog?.find((f) => f.key === key)?.type;
  const isConfirm = (a: AppointmentAnswer) => typeOf(a.key) === 'confirm' && a.value === CONFIRM_YES;

  const AddressLink: React.FC<{ value: string; className?: string }> = ({ value, className: cls = '' }) => (
    <a
      href={mapsSearchUrl(value)}
      target="_blank"
      rel="noopener noreferrer"
      title={t('appointments.answers.openInMaps')}
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-start gap-1.5 text-primary hover:underline ${WRAP} ${cls}`}
    >
      <MapPin size={13} className="shrink-0 mt-0.5" aria-hidden="true" />
      <span className="min-w-0">{value}</span>
      <span className="sr-only">{t('appointments.answers.openInMaps')}</span>
    </a>
  );

  if (compact) {
    const pick = compactAnswer(answers, addresses);
    if (!pick) return null;
    return (
      <div className={`text-sm text-light-text dark:text-dark-text min-w-0 ${className}`} data-testid="answers-compact">
        {addresses.has(pick.key) ? (
          <AddressLink value={pick.value} />
        ) : isConfirm(pick) ? (
          <span className="inline-flex items-center gap-1.5">
            <Check size={13} className="text-emerald-600 shrink-0" aria-hidden="true" />
            <span className={WRAP}>{pick.label}</span>
          </span>
        ) : (
          <span className={WRAP}>
            <span className="text-light-gray">{pick.label}: </span>
            {pick.value}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      className={`bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg min-w-0 ${className}`}
      data-testid="answers-list"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
        {t('appointments.answers.title')}
      </p>
      <ul className="space-y-1.5">
        {answers.map((answer, index) => (
          <li key={`${answer.key}-${index}`} className="text-sm text-gray-700 dark:text-gray-200 min-w-0">
            {isConfirm(answer) ? (
              <span className="inline-flex items-start gap-1.5">
                <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" aria-hidden="true" />
                <span className={WRAP}>{answer.label}</span>
              </span>
            ) : (
              <>
                <span className="block text-xs text-gray-500 dark:text-gray-400 break-words">{answer.label}</span>
                {addresses.has(answer.key) ? (
                  <AddressLink value={answer.value} />
                ) : (
                  <span className={`block ${WRAP}`}>{answer.value}</span>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AnswersList;
