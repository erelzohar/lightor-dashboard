/**
 * Lighty's bolt on every "send to Lighty" button (LT-277), in place of the
 * paper plane. A bolt has no direction, so it is never mirrored for RTL.
 */
export const LightySendIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <img src="/lighty-bolt.webp" alt="" aria-hidden="true" draggable={false} className={`${className} object-contain select-none pointer-events-none`} />
);

/**
 * The round button around it: a light face with a violet ring, so the bolt's
 * purple and yellow read (they vanished on the old purple gradient). Disabled
 * fades and greys the bolt.
 */
export const lightySendButton =
  'shrink-0 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 ring-1 ring-violet-200 dark:ring-violet-700/60 shadow-sm transition-all hover:shadow-md hover:ring-violet-300 dark:hover:ring-violet-500 active:scale-95 disabled:opacity-40 disabled:grayscale disabled:shadow-none disabled:active:scale-100';
