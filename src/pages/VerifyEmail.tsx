import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, Loader } from 'lucide-react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { verifyEmail } from '../services/authApi';
import Button from '../components/ui/Button';

type Status = 'loading' | 'success' | 'error';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { token: pathToken } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { direction } = useTheme();
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    const token = pathToken || searchParams.get('token');
    if (!token) {
      setStatus('error');
      return;
    }
    verifyEmail(token)
      .then(() => setStatus('success'))
      .catch(() => setStatus('error'));
  }, [searchParams, pathToken]);

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 bg-light-bg dark:bg-dark-bg transition-colors duration-200 ${
        direction === 'rtl' ? 'rtl-dir' : 'ltr-dir'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md text-center"
      >
        {status === 'loading' && (
          <>
            <Loader size={56} className="mx-auto mb-4 text-primary animate-spin" />
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
              {t('verify.loading')}
            </h1>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              <CheckCircle size={56} className="mx-auto mb-4 text-green-500" />
            </motion.div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
              {t('verify.successTitle')}
            </h1>
            <p className="text-light-gray dark:text-dark-gray mb-6">
              {t('verify.successMessage')}
            </p>
            <Button onClick={() => navigate('/login')} fullWidth>
              {t('verify.goToLogin')}
            </Button>
          </>
        )}

        {status === 'error' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.1 }}
            >
              <XCircle size={56} className="mx-auto mb-4 text-red-500" />
            </motion.div>
            <h1 className="text-2xl font-bold text-light-text dark:text-dark-text mb-2">
              {t('verify.errorTitle')}
            </h1>
            <p className="text-light-gray dark:text-dark-gray mb-6">
              {t('verify.errorMessage')}
            </p>
            <Button onClick={() => navigate('/login')} fullWidth>
              {t('verify.goToLogin')}
            </Button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
