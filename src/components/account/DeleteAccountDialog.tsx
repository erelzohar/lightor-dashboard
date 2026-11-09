import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Mail } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAccount, type AuthRequestError } from '../../services/authApi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

/**
 * Account deletion's confirm step (LT-031), opened from the account page's
 * danger zone and, since LT-634, from the phone step a new account meets
 * first: Apple wants an account made in the app deletable in the app, and a
 * reviewer with no Israeli mobile never gets past that step.
 *
 * The backend is the authority on what proves intent: a password account must
 * send its password, a social account types its email. The UI reads which
 * from `user.hasPassword` (LT-315); on an API without it, it guesses from
 * googleId/facebookId and falls back to asking for a password if the server
 * demands one anyway (an account that has both a social id and a password).
 *
 * Deletion is billing-safe server-side - a live subscription is cancelled
 * immediately first, and if that fails nothing is deleted, which is why the
 * error path tells the user their account still exists.
 */
const DeleteAccountDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { auth, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const titleId = useId();

  const isSocial = Boolean(auth.user?.googleId || auth.user?.appleId || auth.user?.facebookId);
  const hasPassword = auth.user?.hasPassword ?? !isSocial;
  const [needPassword, setNeedPassword] = useState(hasPassword);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const proofReady = needPassword
    ? password.length > 0
    : confirmEmail.trim().toLowerCase() === (auth.user?.email ?? '').toLowerCase();

  const close = () => {
    if (!deleting) onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(needPassword ? { password } : { confirmEmail: confirmEmail.trim() });
      toast.success(t('danger.deleted'), { duration: 6000 });
      logout();
      navigate('/login', { replace: true });
    } catch (error) {
      // The API answers 400 with a code since LT-315; older deploys said 401
      // with these messages (no longer taken for an expired session).
      const { message = '', code } = error as AuthRequestError;
      if (code === 'PASSWORD_REQUIRED' || message.includes('Password is required')) {
        // Social heuristic was wrong - this account does have a password.
        setNeedPassword(true);
        setPasswordError(t('danger.passwordNeeded'));
      } else if (code === 'WRONG_PASSWORD' || message.includes('Incorrect password')) {
        setPasswordError(t('danger.wrongPassword'));
      } else if (code === 'EMAIL_MISMATCH' || message.includes('Confirmation email does not match')) {
        setEmailError(t('danger.emailMismatch'));
      } else {
        toast.error(t('danger.deleteFailed'));
      }
      setDeleting(false);
    }
  };

  return (
    // Above the phone step (z-60), which can open it.
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 overlay-safe" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="delete-account-dialog"
        className="w-full max-w-md rounded-2xl glass-modal p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-semibold text-red-600 dark:text-red-400">
          {t('danger.modalTitle')}
        </h3>

        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-disc ps-5">
          <li>{t('danger.consequenceSite')}</li>
          <li>{t('danger.consequenceAppointments')}</li>
          <li>{t('danger.consequenceSubscription')}</li>
          <li className="font-medium">{t('danger.consequenceFinal')}</li>
        </ul>

        {needPassword ? (
          <Input
            id="danger-password"
            label={t('danger.passwordLabel')}
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            error={passwordError ?? undefined}
            aria-invalid={passwordError ? true : undefined}
            leftIcon={<KeyRound size={18} />}
            autoFocus
          />
        ) : (
          <Input
            id="danger-confirm-email"
            label={t('danger.confirmEmailLabel', { email: auth.user?.email ?? '' })}
            type="email"
            value={confirmEmail}
            onChange={(e) => {
              setConfirmEmail(e.target.value);
              setEmailError(null);
            }}
            error={emailError ?? undefined}
            aria-invalid={emailError ? true : undefined}
            leftIcon={<Mail size={18} />}
            dir="ltr"
            autoFocus
          />
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={close} disabled={deleting}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={!proofReady || deleting}>
            {deleting ? t('danger.deleting') : t('danger.modalConfirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteAccountDialog;
