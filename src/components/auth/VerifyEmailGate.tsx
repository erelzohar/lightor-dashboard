import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MailWarning, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { resendVerification } from '../../services/authApi';
import Button from '../ui/Button';

/**
 * The verified-email gate (LT-009).
 *
 * Until now an unverified account got a dismissible banner and full access,
 * forever. This replaces the dashboard outright once the grace window (see
 * ProtectedRoute) has passed: verify, or resend and verify, or leave. The
 * "I've verified" button re-reads /auth/me, so verifying in another tab
 * unlocks this one without a reload.
 */
const VerifyEmailGate: React.FC = () => {
  const { auth, refreshUser, logout } = useAuth();
  const { direction } = useTheme();
  const { t } = useTranslation();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleResend = async () => {
    if (!auth.user?.email || resending || resent) return;
    setResending(true);
    try {
      await resendVerification(auth.user.email);
      setResent(true);
      toast.success(t('common.resendVerificationSent'));
    } catch {
      toast.error(t('common.resendVerificationError'));
    } finally {
      setResending(false);
    }
  };

  const handleCheck = async () => {
    setChecking(true);
    const user = await refreshUser();
    setChecking(false);
    if (!user?.isVerified) {
      toast(t('verifyGate.stillUnverified'), { icon: '✉️' });
    }
    // A verified user re-renders ProtectedRoute, which drops this gate.
  };

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
        direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full text-center space-y-6 p-8 rounded-2xl bg-light-surface dark:bg-dark-surface border border-gray-200 dark:border-gray-700 shadow-sm"
      >
        <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <MailWarning className="w-7 h-7 text-amber-600 dark:text-amber-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-light-text dark:text-dark-text">
            {t('verifyGate.title')}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t('verifyGate.desc', { email: auth.user?.email })}
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={handleCheck} disabled={checking} className="w-full">
            <CheckCircle size={16} className={checking ? 'animate-spin' : ''} />
            {t('verifyGate.iVerified')}
          </Button>
          <button
            onClick={handleResend}
            disabled={resending || resent}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={15} className={resending ? 'animate-spin' : ''} />
            {resent ? t('common.resendVerificationSent') : t('verifyGate.resend')}
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <LogOut size={15} />
            {t('verifyGate.signOut')}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmailGate;
