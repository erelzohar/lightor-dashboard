/**
 * Lighty's bolt on every "send to Lighty" button (LT-277), in place of the
 * paper plane. A bolt has no direction, so it is never mirrored for RTL.
 */
export const LightySendIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <img src="/lighty-bolt.webp" alt="" aria-hidden="true" draggable={false} className={`lighty-bolt ${className} object-contain select-none pointer-events-none`} />
);

/**
 * The round button around it. Ready to send (LT-286): a pastel violet→pink→
 * amber face — colour, yet light enough that the bolt's own purple and yellow
 * still read (they vanished on the old solid purple) — and the bolt glints
 * (index.css `lighty-send`). Disabled: a plain white face, the bolt faded,
 * grey and still.
 */
export const lightySendButton =
  'lighty-send shrink-0 rounded-full flex items-center justify-center bg-gradient-to-br from-violet-200 via-fuchsia-100 to-amber-200 dark:from-violet-500/50 dark:via-fuchsia-500/30 dark:to-amber-400/40 ring-1 ring-violet-300 dark:ring-violet-400/60 shadow-md shadow-violet-300/50 dark:shadow-violet-900/40 transition-all hover:shadow-lg hover:ring-violet-400 active:scale-95 disabled:bg-none disabled:bg-white dark:disabled:bg-slate-800 disabled:ring-violet-200 dark:disabled:ring-violet-700/60 disabled:opacity-40 disabled:grayscale disabled:shadow-none disabled:active:scale-100';
