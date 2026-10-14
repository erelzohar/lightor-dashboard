import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

/** "Coming soon" (LT-331): a feature on its way, shown where it will live, not yet usable. */
export const ComingSoonBadge: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
        className
      )}
      data-testid="coming-soon"
    >
      {t('common.comingSoon')}
    </span>
  );
};

/**
 * A feature row that is not here yet: its name, a line on what it will do,
 * the badge, and (optionally) a preview of its control, inert.
 */
export const ComingSoonRow: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  preview?: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, title, description, preview, className }) => (
  <div
    aria-disabled="true"
    className={cn('flex flex-col gap-3 p-4 rounded-xl border border-dashed border-gray-300/80 dark:border-gray-700 bg-gray-50/60 dark:bg-white/[0.02]', className)}
  >
    <div className="flex items-start gap-3">
      <Icon className="w-5 h-5 mt-0.5 shrink-0 text-gray-400 dark:text-gray-500" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
          <ComingSoonBadge />
        </div>
        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
    {preview && <div className="pointer-events-none select-none opacity-60" aria-hidden="true">{preview}</div>}
  </div>
);
