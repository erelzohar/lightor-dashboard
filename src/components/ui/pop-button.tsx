import * as React from 'react';
import { cn } from '../../lib/utils';

/**
 * The pop button (LT-363, from 21st.dev): a solid button with a darker 2px
 * edge and a lip under it, pressed into the page on tap. Erel chose it for
 * every button that looked like the purple "ערוך פרטים".
 *
 * The original draws the lip with a 4px bottom border that shrinks to 2px on
 * press. A border change resizes the button, and a size change under a
 * transition leaves ghost paint on iPhone Safari (LT-351). So the lip is a
 * shadow here, and the press is a 2px translate: nothing about the size moves.
 * `Button` uses the same classes for its filled variants.
 */
export type PopColor = 'primary' | 'danger' | 'success' | 'default';

const POP_COLORS: Record<PopColor, string> = {
  primary: 'bg-primary hover:bg-primary-dark text-white border-violet-800 [--pop-edge:theme(colors.violet.800)]',
  danger: 'bg-red-500 hover:bg-red-600 text-white border-red-800 [--pop-edge:theme(colors.red.800)]',
  success: 'bg-green-500 hover:bg-green-600 text-white border-green-800 [--pop-edge:theme(colors.green.800)]',
  default:
    'bg-white hover:bg-gray-50 text-neutral-900 border-neutral-300 [--pop-edge:theme(colors.neutral.300)] dark:bg-neutral-800 dark:hover:bg-neutral-700 dark:text-neutral-100 dark:border-neutral-600 dark:[--pop-edge:theme(colors.neutral.600)]',
};

// :not(:disabled) rather than enabled:, so links and labels styled as
// buttons press too (they are never :enabled).
const POP_FX =
  'border-2 shadow-[0_2px_0_0_var(--pop-edge)] [&:not(:disabled):active]:translate-y-[2px] [&:not(:disabled):active]:shadow-none transition-[background-color,border-color,box-shadow,transform] duration-100';

/** The pop look's classes, for a button, a link or a label that should wear it. */
export const pop = (color: PopColor = 'primary'): string => `${POP_FX} ${POP_COLORS[color]}`;

type PopSize = 'sm' | 'default' | 'lg';

const SIZES: Record<PopSize, string> = {
  sm: 'h-9 px-3 text-sm',
  default: 'h-10 px-4',
  lg: 'h-14 px-8 text-lg',
};

export interface PopButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  color?: PopColor;
  size?: PopSize;
  children: React.ReactNode;
}

export const PopButton = React.forwardRef<HTMLButtonElement, PopButtonProps>(
  ({ className, color = 'primary', size = 'default', type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-50 disabled:cursor-not-allowed',
        pop(color),
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

PopButton.displayName = 'PopButton';
