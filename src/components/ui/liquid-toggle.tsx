import React, { useId } from 'react';
import { cn } from '../../lib/utils';
import { lightTick } from '../../lib/haptics';

/**
 * LT-311: the liquid switch (21st.dev "liquid-toggle"), adapted for the
 * dashboard — every switch in it is this one.
 *
 * What changed from the original:
 * - controlled: `checked` is the truth (the original copied it into state once
 *   and then ignored the prop, so a save that failed could not turn it back);
 * - the dashboard's primary colour on, a dark-mode track off;
 * - its own gooey filter (a per-switch id), instead of a `<GooeyFilter />`
 *   every page has to remember to mount;
 * - mirrored under RTL, so "on" sits where Hebrew expects it (the left);
 * - a native checkbox with `role="switch"`: it works inside a `<label>`, takes
 *   an id / aria-labelledby, and can be disabled;
 * - a light haptic tick on a change (in the app; a browser gets none).
 */

const SIZES = {
  // The artwork is 52×32; each size keeps that ratio.
  sm: 'h-6 w-[39px]',
  md: 'h-7 w-[46px]',
  lg: 'h-8 w-[52px]',
} as const;

const VARIANTS = {
  default: '[--c-background:var(--color-primary)]',
  success: '[--c-background:#10B981]',
  warning: '[--c-background:#F59E0B]',
  danger: '[--c-background:#EF4444]',
} as const;

export interface ToggleProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'checked' | 'onChange' | 'role'> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Classes for the switch's box (the input takes the rest of the props). */
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  variant = 'default',
  size = 'md',
  className,
  disabled,
  ...inputProps
}: ToggleProps) {
  const filterId = `lt-goo-${useId().replace(/:/g, '')}`;

  return (
    <span
      className={cn(
        'relative inline-block shrink-0 align-middle',
        '[--c-default:#D2D6E9] [--c-default-dark:#C7CBDF] dark:[--c-default:#475569] dark:[--c-default-dark:#526077]',
        SIZES[size],
        disabled ? 'opacity-50' : 'cursor-pointer',
        className
      )}
    >
      <input
        {...inputProps}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        disabled={disabled}
        data-checked={checked}
        onChange={(e) => {
          if (disabled) return; // a browser never sends it; a synthetic click might
          lightTick();
          onCheckedChange?.(e.target.checked);
        }}
        className={cn(
          'block h-full w-full appearance-none rounded-full outline-none',
          'bg-[--c-default] transition-colors duration-500 enabled:hover:bg-[--c-default-dark]',
          'data-[checked=true]:bg-[--c-background] enabled:data-[checked=true]:hover:bg-[--c-background]',
          'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-surface',
          disabled ? 'cursor-not-allowed' : 'cursor-pointer',
          VARIANTS[variant]
        )}
      />
      {/* The knob: one drop that flows across. Mirrored under RTL. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rtl:-scale-x-100">
        <svg viewBox="0 0 52 32" filter={`url(#${filterId})`} className="absolute inset-0 h-full w-full fill-white">
          <defs>
            <filter id={filterId}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
              <feComposite in="SourceGraphic" in2="goo" operator="atop" />
            </filter>
          </defs>
          <circle
            className="transition-transform duration-500"
            cx="16"
            cy="16"
            r="10"
            style={{ transformOrigin: '16px 16px', transform: `translateX(${checked ? '12px' : '0px'}) scale(${checked ? 0 : 1})` }}
          />
          <circle
            className="transition-transform duration-500"
            cx="36"
            cy="16"
            r="10"
            style={{ transformOrigin: '36px 16px', transform: `translateX(${checked ? '0px' : '-12px'}) scale(${checked ? 1 : 0})` }}
          />
        </svg>
      </span>
    </span>
  );
}

export default Toggle;
