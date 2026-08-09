import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Trash2, KeyRound, Mail } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { deleteAccount } from '../../services/authApi';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

/**
 * Account deletion (LT-031).
 *
 * The backend is the authority on what proves intent: a password account must
 * send its password, a social account types its email. The UI guesses which
 * flow to show from googleId/facebookId, and falls back to asking for a
 * password if the server demands one anyway (an account that has both a
 * social id and a password).
 *
 * Deletion is billing-safe server-side — a live subscription is cancelled
 * immediately first, and if that fails nothing is deleted, which is why the
 * error path tells the user their account still exists.
 */
const DangerZoneSection: React.FC = () => {
  const { auth, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const isSocial = Boolean(auth.user?.googleId || auth.user?.facebookId);
  const [modalOpen, setModalOpen] = useState(false);
  const [needPassword, setNeedPassword] = useState(!isSocial);
  const [password, setPassword] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

  const proofReady = needPassword
    ? password.length > 0
    : confirmEmail.trim().toLowerCase() === (auth.user?.email ?? '').toLowerCase();

  const closeModal = () => {
    if (deleting) return;
    setModalOpen(false);
    setPassword('');
    setConfirmEmail('');
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount(needPassword ? { password } : { confirmEmail: confirmEmail.trim() });
      toast.success(t('danger.deleted'), { duration: 6000 });
      logout();
      navigate('/login', { replace: true });
    } catch (error: any) {
      const message: string = error?.message ?? '';
      if (message.includes('Password is required')) {
        // Social heuristic was wrong — this account does have a password.
        setNeedPassword(true);
        toast.error(t('danger.passwordNeeded'));
      } else if (message.includes('Incorrect password')) {
        toast.error(t('danger.wrongPassword'));
      } else {
        toast.error(t('danger.deleteFailed'));
      }
      setDeleting(false);
    }
  };

  return (
    <Card className="border border-red-200 dark:border-red-900/50">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('danger.title')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('danger.desc')}</p>
        <div>
          <Button variant="danger" size="sm" onClick={() => setModalOpen(true)}>
            <span className="flex items-center gap-2">
              <Trash2 size={16} />
              {t('danger.deleteCta')}
            </span>
          </Button>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-dark-surface p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
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
                label={t('danger.passwordLabel')}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<KeyRound size={18} />}
                autoFocus
              />
            ) : (
              <Input
                label={t('danger.confirmEmailLabel', { email: auth.user?.email ?? '' })}
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                leftIcon={<Mail size={18} />}
                dir="ltr"
                autoFocus
              />
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={closeModal} disabled={deleting}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={!proofReady || deleting}
              >
                {deleting ? t('danger.deleting') : t('danger.modalConfirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default DangerZoneSection;
