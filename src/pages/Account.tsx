import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, KeyRound, Eye, EyeOff, Languages } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Select from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n/config';
import BillingSection from '../components/account/BillingSection';
import DangerZoneSection from '../components/account/DangerZoneSection';
import NotificationsCard from '../components/account/NotificationsCard';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../hooks/useAppSelector';
import { isLeadsSite } from '../utils/siteMode';

// Native names — a language selector should read in the language it selects.
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  en: 'English',
  he: 'עברית',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
};

const Account: React.FC = () => {
  const { auth, updateUser, updatePassword } = useAuth();
  const { changeLanguage } = useTheme();
  const { t } = useTranslation();
  // A leads site (LT-199) takes no bookings: its billing card counts leads
  // only, and its owner is notified of new leads only.
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const leadsSite = isLeadsSite(webConfig);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: auth.user?.name || '',
    email: auth.user?.email || '',
    phone: auth.user?.phone || '',
    defaultLanguage: auth.user?.defaultLanguage || 'he'
  });
  const [language, setLanguage] = useState<SupportedLanguage>((auth.user?.defaultLanguage as SupportedLanguage) ?? 'he');
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  React.useEffect(() => {
    if (auth.user) {
      setFormData({
        name: auth.user.name || '',
        email: auth.user.email || '',
        phone: auth.user.phone || '',
        defaultLanguage: auth.user.defaultLanguage || 'he'
      });
      setLanguage((auth.user.defaultLanguage as SupportedLanguage) ?? 'he');
    }
  }, [auth.user]);

  document.title = t('account.title');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleLanguageChange = async (value: SupportedLanguage) => {
    const previous = language;
    setLanguage(value);
    changeLanguage(value); // instant: swaps the dashboard UI + direction now
    setIsSavingLanguage(true);
    try {
      await updateUser({ defaultLanguage: value });
      toast.success(t('account.languageUpdateSuccess'));
    } catch {
      // Roll back both the persisted intent and the live UI on failure.
      setLanguage(previous);
      changeLanguage(previous);
      toast.error(t('account.languageUpdateError'));
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUser(formData);
      toast.success(t('account.updateSuccess'));
      setIsEditing(false);
    } catch (error) {
      toast.error(t('account.updateError'));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(t('account.passwordMismatch'));
      return;
    }

    try {
      await updatePassword(passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword);
      toast.success(t('account.passwordUpdateSuccess'));
      setIsChangingPassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      let errorMessage = error.message;
      if (errorMessage === 'Current password is incorrect') {
        errorMessage = t('account.passwordCurrentIncorrect');
      } else if (errorMessage === 'New password cannot be the same as the current password') {
        errorMessage = t('account.passwordSameAsOld');
      } else {
        errorMessage = t('account.passwordUpdateError');
      }
      toast.error(errorMessage || t('account.passwordUpdateError'));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <User className="text-primary w-6 h-6 shrink-0" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            {t('account.title')}
          </h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('account.description')}
        </p>
      </div>

      {/* How and about what the owner hears — email, SMS or WhatsApp, one
          switch per event (LT-129, LT-213) */}
      <NotificationsCard leadsSite={leadsSite} />

      {/* Dashboard Language Card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Languages className="w-5 h-5 text-primary shrink-0" />
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                {t('account.language')}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {t('account.languageDesc')}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-48 shrink-0">
            <Select
              value={language}
              disabled={isSavingLanguage}
              onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
              options={SUPPORTED_LANGUAGES.map((lng) => ({ value: lng, label: LANGUAGE_NAMES[lng] }))}
            />
          </div>
        </div>
      </Card>

      <BillingSection leadsSite={leadsSite} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-medium shadow-lg shadow-primary/20">
                  {auth.user?.name.charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">{auth.user?.name}</h2>
                </div>
              </div>
              <Button
                variant={isEditing ? 'secondary' : 'primary'}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? t('common.cancel') : t('account.editDetails')}
              </Button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={t('account.name')}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  leftIcon={<User size={18} />}
                  required
                />

                <Input
                  label={t('account.phone')}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  leftIcon={<Phone size={18} />}
                  required
                />

                <div className="flex justify-end">
                  <Button type="submit">
                    {t('account.saveChanges')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-light-gray dark:text-dark-gray" />
                  <span className="text-light-text dark:text-dark-text">{auth.user?.phone}</span>
                </div>
              </div>
            )}

            {/* Change Password Section */}
            <div className="mt-8 pt-6 border-t border-light-gray/10 dark:border-dark-gray/10">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <KeyRound size={20} className="text-primary" />
                  <h3 className="font-semibold text-lg text-light-text dark:text-dark-text">
                    {t('account.changePassword')}
                  </h3>
                </div>
                <Button
                  variant={isChangingPassword ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                >
                  {isChangingPassword ? t('common.cancel') : t('account.changePassword')}
                </Button>
              </div>

              {isChangingPassword && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <Input
                    label={t('account.currentPassword')}
                    name="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={
                      <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="focus:outline-none">
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />

                  <Input
                    label={t('account.newPassword')}
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={
                      <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="focus:outline-none">
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />

                  <Input
                    label={t('account.confirmPassword')}
                    name="confirmPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    required
                  />

                  <div className="flex justify-end">
                    <Button type="submit" variant="primary">
                      {t('account.updatePassword')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>
      </div>

      <DangerZoneSection />

      <div className="flex justify-center gap-6 pt-2 pb-6">
        <a
          href="https://lightor.app/terms.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
        >
          {t('legal.terms')}
        </a>
        <a
          href="https://lightor.app/privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 dark:text-gray-500 hover:text-primary transition-colors"
        >
          {t('legal.privacy')}
        </a>
      </div>
    </motion.div>
  );
};

export default Account;
