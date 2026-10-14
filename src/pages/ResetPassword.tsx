import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Lock, Eye, EyeOff } from 'lucide-react';
import { AuthCard, AuthInput, AuthButton, AuthNotice } from '../components/auth/AuthCard';
import { resetPassword, type AuthRequestError } from '../services/authApi';
import { saveSession } from '../services/nativeSession';
import { setSessionHint } from '../services/sessionHint';
import { passwordProblem } from '../utils/passwordRules';

/**
 * The emailed reset link lands here: /reset-password/:token (LT-315).
 *
 * A new password, typed twice, under the register form's rules. On success
 * the API sets the session cookie (and returns the JWT the native app keeps
 * as its Bearer), so the owner is signed in: like the signup handoff, we
 * leave with a full `location.replace('/')`, which makes AuthContext start
 * from the new session and swaps this token-bearing entry out of history.
 * A 400 means the link is invalid, used or expired — the way on is a new one.
 */
const ResetPassword: React.FC = () => {
  const { t } = useTranslation();
  const { token = '' } = useParams<{ token: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(false);

  document.title = t('resetPassword.title');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const problem = passwordProblem(password);
    if (problem) {
      setError(t(`resetPassword.rule.${problem}`));
      return;
    }
    if (password !== confirm) {
      setError(t('resetPassword.mismatch'));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const { token: session } = await resetPassword(token, password);
      // Native app: the body's JWT is the Bearer the reload hydrates from
      // (no-op on the web, where the cookie is the session).
      if (session) await saveSession(session);
      // Tell the next load a session exists, or it skips the /auth/me probe
      // and shows the login page (LT-164).
      setSessionHint();
      window.location.replace('/');
    } catch (err) {
      const status = (err as AuthRequestError).status;
      if (status === 400 || status === 404) setLinkDead(true);
      else setError(status === 429 ? t('forgotPassword.tooMany') : t('resetPassword.failed'));
      setSaving(false);
    }
  };

  if (linkDead || !token) {
    return (
      <AuthCard title={t('resetPassword.title')}>
        <AuthNotice tone="error">{t('resetPassword.invalidLink')}</AuthNotice>
        <Link
          to="/forgot-password"
          replace
          className="w-full h-10 rounded-lg bg-white text-black text-sm font-medium flex items-center justify-center"
        >
          {t('resetPassword.requestNew')}
        </Link>
        <p className="text-center mt-5">
          <Link to="/login" replace className="text-xs text-white/60 hover:text-white transition-colors">
            {t('forgotPassword.backToLogin')}
          </Link>
        </p>
      </AuthCard>
    );
  }

  const eye = (
    <button
      type="button"
      onClick={() => setShow((s) => !s)}
      aria-label={show ? t('login.hidePassword') : t('login.showPassword')}
      className="text-white/40 hover:text-white transition-colors"
    >
      {show ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
    </button>
  );

  return (
    <AuthCard title={t('resetPassword.title')} subtitle={t('resetPassword.subtitle')}>
      <form onSubmit={submit} className="space-y-3">
        {error && <AuthNotice tone="error">{error}</AuthNotice>}
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          end={eye}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          aria-label={t('resetPassword.newPassword')}
          placeholder={t('resetPassword.newPassword')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        <AuthInput
          icon={<Lock className="w-4 h-4" />}
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          aria-label={t('resetPassword.confirmPassword')}
          placeholder={t('resetPassword.confirmPassword')}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <p className="text-[0.6875rem] text-white/50 px-1">{t('resetPassword.rules')}</p>
        <div className="pt-2">
          <AuthButton busy={saving}>{t('resetPassword.submit')}</AuthButton>
        </div>
      </form>
      <p className="text-center mt-5">
        <Link to="/login" replace className="text-xs text-white/60 hover:text-white transition-colors">
          {t('forgotPassword.backToLogin')}
        </Link>
      </p>
    </AuthCard>
  );
};

export default ResetPassword;
