import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, KeyRound, Mail } from 'lucide-react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAccount, getDeletionPreview, type AuthRequestError, type DeletionPreview } from '../../services/authApi';
import { STORE_SUBSCRIPTIONS_URL, billsOnAfterDeletion, storeOfAccount } from '../../lib/storeLinks';
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
 *
 * LT-663 (Erel 2026-11-15): that is Paddle's. A subscription bought in an app
 * is the store's and only its owner can cancel it there, so for one the
 * dialog says billing goes on (as Apple's account-deletion guidance asks),
 * links to the store's page, and asks for a tick before the delete. It also
 * says how many bookings are still ahead: they are deleted and nobody is
 * texted. Both come from the server; until it answers, the store is read from
 * the signed-in account.
 *
 * LT-668 (Erel 2026-11-16): the deletion stops a Google Play subscription's
 * renewal itself, so only an App Store one gets the warning and the tick; a
 * Google Play one reads "cancelled", like Paddle's.
 *
 * LT-708 (Erel 2026-11-23): drawn on <body>, like ConfirmDialog. Inside the
 * account page's danger-zone card its "fixed inset-0" filled only the card:
 * the card's backdrop-filter (glass-card) makes it the containing block of
 * any fixed child, so the dim was a band the card's height and the dialog
 * spilled out of it.
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
  const [preview, setPreview] = useState<DeletionPreview | null>(null);
  const [storeAck, setStoreAck] = useState(false);
  const ackId = useId();

  useEffect(() => {
    let alive = true;
    void getDeletionPreview().then((answer) => {
      if (alive) setPreview(answer);
    });
    return () => {
      alive = false;
    };
  }, []);

  const store = billsOnAfterDeletion(preview ? preview.storeSubscription : storeOfAccount(auth.user));
  const storeName = t('billing.store.appStore');
  const futureBookings = preview?.futureBookings ?? 0;

  const proofReady = (needPassword
    ? password.length > 0
    : confirmEmail.trim().toLowerCase() === (auth.user?.email ?? '').toLowerCase())
    && (!store || storeAck);

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

  return createPortal(
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
          {futureBookings > 0 && (
            <li data-testid="delete-future-bookings">{t('danger.consequenceBookings', { count: futureBookings })}</li>
          )}
          {!store && <li>{t('danger.consequenceSubscription')}</li>}
          <li className="font-medium">{t('danger.consequenceFinal')}</li>
        </ul>

        {store && (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2.5 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100"
            data-testid="delete-store-warning"
          >
            <p className="font-medium">{t('danger.consequenceStore', { store: storeName })}</p>
            <a
              href={STORE_SUBSCRIPTIONS_URL[store]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-medium underline underline-offset-2"
              data-testid="delete-store-manage"
            >
              <ExternalLink size={14} className="shrink-0" aria-hidden="true" />
              {t('billing.store.manage', { store: storeName })}
            </a>
            <div className="flex items-start gap-2">
              <input
                id={ackId}
                type="checkbox"
                checked={storeAck}
                onChange={(e) => setStoreAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-400 text-red-600 focus:ring-red-500"
              />
              <label htmlFor={ackId}>{t('danger.storeAck', { store: storeName })}</label>
            </div>
          </div>
        )}

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
    </div>,
    document.body
  );
};

export default DeleteAccountDialog;
