import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Suggestion } from '../../utils/lightySuggestions';

/**
 * LT-566: one of Lighty's ready questions. A tap asks it; the number (new
 * leads, bookings that day) is on the chip only, the question goes alone.
 */
export const SuggestionChip: React.FC<{
  suggestion: Suggestion;
  onAsk: (text: string) => void;
  disabled?: boolean;
  /** Size, background and hover; the shape and the text colour are the chip's own. */
  className?: string;
}> = ({ suggestion, onAsk, disabled, className = '' }) => {
  const { t } = useTranslation();
  const text = t(`lighty.suggest.${suggestion.key}`);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onAsk(text)}
      data-testid={`lighty-suggest-${suggestion.key}`}
      className={`inline-flex items-center gap-1.5 rounded-full border text-violet-700 dark:text-violet-200 whitespace-nowrap ${className}`}
    >
      {text}
      {suggestion.count ? (
        <span className="min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-violet-600 text-white text-[11px] font-semibold tabular-nums">
          {suggestion.count > 99 ? '99+' : suggestion.count}
        </span>
      ) : null}
    </button>
  );
};
