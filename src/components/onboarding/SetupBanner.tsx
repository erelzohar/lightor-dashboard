import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface SetupStep {
  key: string;
  done: boolean;
  tab: string;
}

interface Props {
  steps: SetupStep[];
}

const SetupBanner: React.FC<Props> = ({ steps }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const doneCount = steps.filter(s => s.done).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 dark:bg-primary/10 p-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <p className="text-sm font-semibold text-light-text dark:text-dark-text">
              {t('onboarding.setupProgress', { done: doneCount, total: steps.length })}
            </p>
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-light-gray/20 dark:bg-dark-gray/20 rounded-full mb-3 overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(doneCount / steps.length) * 100}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            {steps.map(step => (
              <div key={step.key} className="flex items-center gap-1.5">
                {step.done ? (
                  <CheckCircle2 size={15} className="text-green-500 shrink-0" />
                ) : (
                  <Circle size={15} className="text-light-gray dark:text-dark-gray shrink-0" />
                )}
                <span
                  className={`text-xs ${step.done ? 'line-through text-light-gray dark:text-dark-gray' : 'text-light-text dark:text-dark-text'}`}
                >
                  {t(`onboarding.step_${step.key}`)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => navigate('/settings')}
          className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0 self-end sm:self-auto"
        >
          {t('onboarding.completeSetup')}
          <ArrowRight size={15} />
        </button>
      </div>
    </motion.div>
  );
};

export default SetupBanner;
