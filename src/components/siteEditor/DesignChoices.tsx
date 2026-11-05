import React, { useState } from 'react';
import { PAID_BACKGROUNDS, PAID_LAYOUTS } from '../../utils/editorOptions';
import { PaidMark } from './MotionPlan';

/**
 * LT-595 (Erel: "instead of only the design's name, a picture that shows it
 * best"): every design the editor offers is a picture of it, drawn by the
 * site itself (a sample business, he + en, scratchpad recipe in the LT-595
 * log), under `public/designs/<he|en>/<group>-<value>.webp`; the designs that
 * move by themselves also have a short loop, `.anim.webp`, shown unless the
 * device asks for less motion. The name stays under the picture.
 */

/** The picture's group: the section as the editor knows it; the gallery and the reviews have two names each. */
export const pictureGroup = (type: string): string =>
  type === 'portfolio' ? 'gallery' : type === 'testimonials' ? 'quote' : type;

/** The groups whose moving designs have a loop: a section's paid layouts, the hero's paid backdrops. */
export const movesByItself = (group: string, value: string): boolean =>
  group === 'herobg' ? PAID_BACKGROUNDS.includes(value) : (PAID_LAYOUTS[group] ?? []).includes(value);

/** Hebrew pictures for Hebrew, English for the rest (as the style pictures, LT-426). */
export const designPicture = (group: string, value: string, language: string, loop = false): string =>
  `/designs/${language.startsWith('he') ? 'he' : 'en'}/${group}-${value}${loop ? '.anim' : ''}.webp`;

export interface DesignChoicesProps {
  /** The radio group's name. */
  name: string;
  group: string;
  values: readonly string[];
  current: string | undefined;
  labelOf: (value: string) => string;
  onPick: (value: string) => void;
  language: string;
  /** The crown, on the paid designs the plan does not include (or wherever the caller marks them). */
  marked?: (value: string) => boolean;
  columns?: string;
  testId?: string;
}

const Picture: React.FC<{ group: string; value: string; language: string }> = ({ group, value, language }) => {
  const [missing, setMissing] = useState(false);
  const still = designPicture(group, value, language);
  const loop = movesByItself(group, value);
  if (missing) return null;
  return (
    <picture>
      {loop && <source srcSet={still} media="(prefers-reduced-motion: reduce)" />}
      <img
        src={loop ? designPicture(group, value, language, true) : still}
        alt=""
        loading="lazy"
        decoding="async"
        width={336}
        height={210}
        draggable={false}
        onError={() => setMissing(true)}
        className="block h-full w-full object-cover object-top"
      />
    </picture>
  );
};

const DesignChoices: React.FC<DesignChoicesProps> = ({ name, group, values, current, labelOf, onPick, language, marked, columns = 'grid-cols-2', testId }) => (
  <div className={`grid gap-2 ${columns}`} role="radiogroup" aria-label={name} data-testid={testId}>
    {values.map((value) => {
      const on = current === value;
      return (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onPick(value)}
          data-design={`${group}-${value}`}
          className={`flex min-w-0 flex-col gap-1.5 rounded-xl border p-1.5 text-start transition-colors ${
            on
              ? 'border-primary bg-primary/5 ring-1 ring-primary'
              : 'border-gray-200 bg-white hover:border-primary/50 dark:border-slate-600 dark:bg-slate-800'
          }`}
        >
          <span className="block aspect-[16/10] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-slate-700/60" aria-hidden="true">
            <Picture group={group} value={value} language={language} />
          </span>
          <span className={`flex items-center px-0.5 text-[11px] font-medium leading-tight ${on ? 'text-primary' : 'text-gray-600 dark:text-slate-300'}`}>
            <span className="min-w-0 break-words">{labelOf(value)}</span>
            {marked?.(value) && <PaidMark on={false} />}
          </span>
        </button>
      );
    })}
  </div>
);

export default DesignChoices;
