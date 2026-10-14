import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import { AuthCard, AuthInput, AuthButton, AuthNotice } from '../components/auth/AuthCard';
import { requestPasswordReset, type AuthRequestError } from '../services/authApi';

/**
 * "Forgot your password?" (LT-315). The owner types their email and the API
 * mails a link to /reset-password/:token. The answer is the same whether or
 * not an account exists — the page never confirms one — so the only things
 * shown as errors are the ones that say nothing about the address: too many
 * tries, or the request not getting through.
 */
const ForgotPassword: React.FC = () => {
  const { t } = useTranslation();
  // The login form hands over what was typed there, so it need not be typed twice.
  const handed = (useLocation().state as { email?: unknown } | null)?.email;
  const [email, setEmail] = useState(typeof handed === 'string' ? handed : '');
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  document.title = t('forgotPassword.title');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const address = email.trim();
    if (!address || sending) return;
    setError(null);
    setSending(true);
    try {
      await requestPasswordReset(address);
      setSentTo(address);
    } catch (err) {
      setError((err as AuthRequestError).status === 429 ? t('forgotPassword.tooMany') : t('forgotPassword.failed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <AuthCard title={t('forgotPassword.title')} subtitle={sentTo ? undefined : t('forgotPassword.subtitle')}>
      {sentTo ? (
        <AuthNotice tone="success">
          {t('forgotPassword.sent')}
          {/* Its own line, left to right: an address inside a Hebrew sentence scrambles. */}
          <span dir="ltr" className="block mt-1 font-medium break-all">{sentTo}</span>
        </AuthNotice>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <AuthInput
            icon={<Mail className="w-4 h-4" />}
            type="email"
            autoComplete="email"
            dir="ltr"
            aria-label={t('login.email')}
            placeholder={t('login.enterEmail')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <AuthButton busy={sending}>{t('forgotPassword.submit')}</AuthButton>
        </form>
      )}
      <p className="text-center mt-5">
        <Link to="/login" replace className="text-xs text-white/60 hover:text-white transition-colors">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  );
};

export default ForgotPassword;
