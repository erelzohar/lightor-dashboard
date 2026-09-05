import React from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown } from 'lucide-react';

/**
 * Stands in for a Plus-only panel on the free plan (LT-125) — the Dashboard's
 * amber upgrade banner, as a reusable card. Display only: the API refuses the
 * gated call regardless of what the client renders.
 */
interface UpgradeCardProps {
  title: string;
  description: string;
  className?: string;
}

const UpgradeCard: React.FC<UpgradeCardProps> = ({ title, description, className = '' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={className}>
      <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 dark:bg-amber-800/40 rounded-full text-amber-600 dark:text-amber-400 shrink-0">
            <Crown className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-300 text-sm">{title}</h3>
            <p className="text-amber-700/80 dark:text-amber-400 text-xs mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/account')}
          className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors whitespace-nowrap"
        >
          {t('common.upgradePlanBtn')}
        </button>
      </div>
    </motion.div>
  );
};

export default UpgradeCard;
