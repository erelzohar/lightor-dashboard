import React from 'react';
import { motion } from 'framer-motion';
import Card from './Card';

/**
 * KPI tile (LT-058) — the IncomeStats card pattern extracted into a reusable
 * component: icon chip, label, big value, optional sub-line and accent bar.
 */
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  subline?: React.ReactNode;
  icon: React.ReactNode;
  /** Tailwind classes for the icon chip background, e.g. 'bg-blue-100 dark:bg-blue-900/30'. */
  iconBg?: string;
  /** Tailwind class for the bottom accent bar, e.g. 'bg-blue-500'. */
  accent?: string;
  delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subline,
  icon,
  iconBg = 'bg-primary/10',
  accent = 'bg-primary',
  delay = 0,
}) => (
  <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
    <Card animate={false} className="relative overflow-hidden h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-light-gray font-medium">{label}</p>
          <h4 className="text-2xl font-bold mt-1 text-gray-900 dark:text-dark-text">{value}</h4>
          {subline && <p className="text-xs text-light-gray mt-0.5">{subline}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${iconBg} shrink-0`}>{icon}</div>
      </div>
      <div className={`absolute bottom-0 left-0 w-full h-0.5 ${accent} opacity-40`} />
    </Card>
  </motion.div>
);

export default StatCard;
