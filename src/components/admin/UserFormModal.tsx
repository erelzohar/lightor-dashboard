import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserPlus, UserCog, Dices } from 'lucide-react';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import ToggleSwitch from '../ui/ToggleSwitch';
import { createUser, AdminUserRow } from '../../services/adminApi';
import { updateUserInfo } from '../../services/userApi';

/**
 * Create / edit a user from the admin panel (LT-058 follow-up).
 *
 * One form, two modes: 'create' POSTs the admin endpoint (password, verified
 * toggle); 'edit' PUTs the regular /users/:id route, which allows the
 * operator to edit anyone (ownership fix) and only ever writes the
 * allowlisted profile fields — role and billing stay with their dedicated
 * actions on the detail page. Validation is the server's; its real message
 * ("Email already in use") surfaces in the toast.
 */
interface UserFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  /** Prefill for edit mode. */
  user?: Pick<AdminUserRow, '_id' | 'name' | 'email' | 'phone' | 'defaultLanguage' | 'channelType'> & { username?: string };
  onClose: () => void;
  /** Fires after a successful save with the affected user's id. */
  onSaved: (userId: string) => void;
}

const LANGUAGES = ['he', 'en', 'ar', 'fr', 'es'];

/** A memorable-enough temp password satisfying the letters+digits/6+ rule. */
const generatePassword = (): string => {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const pick = (pool: string, n: number) =>
    Array.from({ length: n }, () => pool[Math.floor(Math.random() * pool.length)]).join('');
  return `${pick(letters, 4)}${Math.floor(1000 + Math.random() * 9000)}`;
};

const UserFormModal: React.FC<UserFormModalProps> = ({ open, mode, user, onClose, onSaved }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    phone: '',
    defaultLanguage: 'he',
    channelType: 'sms' as 'sms' | 'whatsapp',
    isVerified: true,
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      username: user?.username ?? '',
      password: '',
      phone: user?.phone ?? '',
      defaultLanguage: user?.defaultLanguage ?? 'he',
      channelType: user?.channelType ?? 'sms',
      isVerified: true,
    });
  }, [open, user]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'create') {
        const created = await createUser({
          name: form.name.trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          defaultLanguage: form.defaultLanguage,
          channelType: form.channelType,
          isVerified: form.isVerified,
        });
        toast.success(t('admin.userForm.created'));
        onSaved(created._id);
      } else {
        const updated = await updateUserInfo(user!._id, {
          name: form.name.trim(),
          email: form.email.trim(),
          ...(form.username.trim() ? { username: form.username.trim() } : {}),
          phone: form.phone.trim(),
          defaultLanguage: form.defaultLanguage,
          channelType: form.channelType,
        });
        toast.success(t('admin.userForm.saved'));
        onSaved(updated._id);
      }
      onClose();
    } catch (error) {
      const axiosMessage =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const message = axiosMessage ?? (error instanceof Error ? error.message : null);
      toast.error(message || t('admin.errors.actionFailed'));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-light-surface rounded-2xl shadow-xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 mb-5">
              {mode === 'create' ? (
                <UserPlus size={18} className="text-primary" />
              ) : (
                <UserCog size={18} className="text-primary" />
              )}
              {t(mode === 'create' ? 'admin.userForm.titleCreate' : 'admin.userForm.titleEdit')}
            </h3>

            <form onSubmit={submit} className="space-y-4">
              <Input
                label={t('admin.userForm.name')}
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
                maxLength={50}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={t('admin.userForm.email')}
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required
                />
                <Input
                  label={t('admin.userForm.username')}
                  dir="ltr"
                  value={form.username}
                  onChange={(e) => set('username', e.target.value)}
                  required={mode === 'create'}
                  minLength={3}
                  maxLength={35}
                />
              </div>

              {mode === 'create' && (
                <div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <Input
                        label={t('admin.userForm.password')}
                        dir="ltr"
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-1"
                      onClick={() => set('password', generatePassword())}
                      leftIcon={<Dices size={14} />}
                    >
                      {t('admin.userForm.generate')}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t('admin.userForm.passwordHint')}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input
                  label={t('admin.userForm.phone')}
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
                <Select
                  label={t('admin.userForm.language')}
                  value={form.defaultLanguage}
                  onChange={(e) => set('defaultLanguage', e.target.value)}
                  options={LANGUAGES.map((lang) => ({ value: lang, label: lang.toUpperCase() }))}
                />
                <Select
                  label={t('admin.userForm.channel')}
                  value={form.channelType}
                  onChange={(e) => set('channelType', e.target.value as 'sms' | 'whatsapp')}
                  options={[
                    { value: 'sms', label: 'SMS' },
                    { value: 'whatsapp', label: 'WhatsApp' },
                  ]}
                />
              </div>

              {mode === 'create' && (
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {t('admin.userForm.verified')}
                    </p>
                    <p className="text-xs text-gray-400">{t('admin.userForm.verifiedHint')}</p>
                  </div>
                  <ToggleSwitch
                    checked={form.isVerified}
                    onChange={(checked: boolean) => set('isVerified', checked)}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                  {t('admin.actions.cancel')}
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={saving}>
                  {t(mode === 'create' ? 'admin.userForm.create' : 'admin.userForm.save')}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default UserFormModal;
