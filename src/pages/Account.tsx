import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { User, Phone, KeyRound, Eye, EyeOff } from 'lucide-react';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import toast from 'react-hot-toast';

const Account: React.FC = () => {
  const { auth, updateUser, updatePassword } = useAuth();
  const { language } = useTheme();
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
    }
  }, [auth.user]);

  document.title = language === "he" ? "חשבון" : "Account";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateUser(formData);
      toast.success(
        language === 'he'
          ? 'הפרטים עודכנו בהצלחה'
          : 'Account updated successfully'
      );
      setIsEditing(false);
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'אירעה שגיאה בעדכון הפרטים'
          : 'Failed to update account'
      );
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error(
        language === 'he'
          ? 'הסיסמאות אינן תואמות'
          : 'Passwords do not match'
      );
      return;
    }

    try {
      await updatePassword(passwordData.currentPassword, passwordData.newPassword, passwordData.confirmPassword);
      toast.success(
        language === 'he'
          ? 'הסיסמה עודכנה בהצלחה'
          : 'Password updated successfully'
      );
      setIsChangingPassword(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error: any) {      
      let errorMessage = error.message;
      if (language === 'he') {
        if (errorMessage === 'Current password is incorrect') {
          errorMessage = 'הסיסמה הנוכחית שגויה';
        } else if (errorMessage === 'New password cannot be the same as the current password') {
          errorMessage = 'הסיסמה החדשה אינה יכולה להיות זהה לסיסמה הנוכחית';
        } else {
          errorMessage = 'אירעה שגיאה בעדכון הסיסמה';
        }
      }

      toast.error(errorMessage || (language === 'he' ? 'אירעה שגיאה בעדכון הסיסמה' : 'Failed to update password'));
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Page Title */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <User className="text-primary w-5 h-5" />
          <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
            {language === 'he' ? 'הגדרות חשבון' : 'Account Settings'}
          </h1>
        </div>
        <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
          {language === 'he'
            ? 'נהל את פרטי המשתמש שלך'
            : 'Manage your user details and subscription'
          }
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Info Card */}
        <div className="lg:col-span-2">
          <Card>
            <div className="flex justify-between items-start mb-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary text-white flex items-center justify-center text-2xl font-medium shadow-lg shadow-primary/20">
                  {auth.user?.name.charAt(0).toUpperCase() || 'A'}
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-light-text dark:text-dark-text">{auth.user?.name}</h2>
                  {/* <p className="text-light-gray dark:text-dark-gray">{auth.user?.email}</p> */}
                </div>
              </div>
              <Button
                variant={isEditing ? 'secondary' : 'primary'}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing
                  ? (language === 'he' ? 'ביטול' : 'Cancel')
                  : (language === 'he' ? 'ערוך פרטים' : 'Edit Details')
                }
              </Button>
            </div>

            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label={language === 'he' ? 'שם' : 'Name'}
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  leftIcon={<User size={18} />}
                  required
                />

                {/* <Input
                  label={language === 'he' ? 'אימייל' : 'Email'}
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  leftIcon={<Mail size={18} />}
                  required
                /> */}

                <Input
                  label={language === 'he' ? 'טלפון' : 'Phone'}
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  leftIcon={<Phone size={18} />}
                  required
                />

                {/* <div>
                  <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-2">
                    {language === 'he' ? 'שפת ממשק' : 'Interface Language'}
                  </label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="defaultLanguage"
                        value="he"
                        checked={formData.defaultLanguage === 'he'}
                        onChange={handleChange}
                        className="form-radio text-primary"
                      />
                      <span className="ml-2 text-light-text dark:text-dark-text">
                        {language === 'he' ? 'עברית' : 'Hebrew'}
                      </span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        name="defaultLanguage"
                        value="en"
                        checked={formData.defaultLanguage === 'en'}
                        onChange={handleChange}
                        className="form-radio text-primary"
                      />
                      <span className="ml-2 text-light-text dark:text-dark-text">
                        {language === 'he' ? 'אנגלית' : 'English'}
                      </span>
                    </label>
                  </div>
                </div> */}

                <div className="flex justify-end">
                  <Button type="submit">
                    {language === 'he' ? 'שמור שינויים' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                {/* <div className="flex items-center gap-3">
                  <User size={18} className="text-light-gray dark:text-dark-gray" />
                  <span className="text-light-text dark:text-dark-text">{auth.user?.name}</span>
                </div> */}
                {/* <div className="flex items-center gap-3">
                  <Mail size={18} className="text-light-gray dark:text-dark-gray" />
                  <span className="text-light-text dark:text-dark-text">{auth.user?.email}</span>
                </div> */}
                <div className="flex items-center gap-3">
                  <Phone size={18} className="text-light-gray dark:text-dark-gray" />
                  <span className="text-light-text dark:text-dark-text">{auth.user?.phone}</span>
                </div>
                {/* <div className="flex items-center gap-3">
                  <Globe size={18} className="text-light-gray dark:text-dark-gray" />
                  <span className="text-light-text dark:text-dark-text">
                    {auth.user?.defaultLanguage === 'he'
                      ? 'עברית'
                      : 'English'
                    }
                  </span>
                </div> */}
              </div>
            )}

            {/* Change Password Section */}
            <div className="mt-8 pt-6 border-t border-light-gray/10 dark:border-dark-gray/10">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <KeyRound size={20} className="text-primary" />
                  <h3 className="font-semibold text-lg text-light-text dark:text-dark-text">
                    {language === 'he' ? 'שינוי סיסמה' : 'Change Password'}
                  </h3>
                </div>
                <Button
                  variant={isChangingPassword ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setIsChangingPassword(!isChangingPassword)}
                >
                  {isChangingPassword
                    ? (language === 'he' ? 'ביטול' : 'Cancel')
                    : (language === 'he' ? 'שנה סיסמה' : 'Change Password')
                  }
                </Button>
              </div>

              {isChangingPassword && (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <Input
                    label={language === 'he' ? 'סיסמה נוכחית' : 'Current Password'}
                    name="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                        className="focus:outline-none"
                      >
                        {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />

                  <Input
                    label={language === 'he' ? 'סיסמה חדשה' : 'New Password'}
                    name="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="focus:outline-none"
                      >
                        {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    }
                    required
                  />

                  <Input
                    label={language === 'he' ? 'אימות סיסמה חדשה' : 'Confirm New Password'}
                    name="confirmPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={handlePasswordChange}
                    leftIcon={<KeyRound size={18} />}
                    required
                  />

                  <div className="flex justify-end">
                    <Button type="submit" variant="primary">
                      {language === 'he' ? 'עדכן סיסמה' : 'Update Password'}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </Card>
        </div>

        {/* Subscription Info */}
        {/* <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-light-text dark:text-dark-text">
                {language === 'he' ? 'פרטי מנוי' : 'Subscription'}
              </h3>
              {subscriptionBadge()}
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-light-gray/5 dark:bg-dark-bg">
                <div className="flex items-center mb-2">
                  <Shield size={18} className="text-primary mr-2" />
                  <span className="font-medium text-light-text dark:text-dark-text">
                    {language === 'he' ? 'הגנת מנוי' : 'Subscription Protection'}
                  </span>
                </div>
                <p className="text-sm text-light-gray dark:text-dark-gray">
                  {language === 'he'
                    ? 'המנוי שלך מוגן ומאובטח. תאריך החידוש הבא: 1.4.2024'
                    : 'Your subscription is protected and secure. Next renewal: 1.4.2024'
                  }
                </p>
              </div>

              <div className="p-4 rounded-xl bg-light-gray/5 dark:bg-dark-bg">
                <div className="flex items-center mb-2">
                  <CreditCard size={18} className="text-primary mr-2" />
                  <span className="font-medium text-light-text dark:text-dark-text">
                    {language === 'he' ? 'פרטי תשלום' : 'Payment Details'}
                  </span>
                </div>
                <p className="text-sm text-light-gray dark:text-dark-gray">
                  {language === 'he'
                    ? 'כרטיס אשראי מסתיים ב-4242'
                    : 'Credit card ending in 4242'
                  }
                </p>
              </div>

              <Button variant="outline" fullWidth>
                {language === 'he' ? 'שדרג מנוי' : 'Upgrade Subscription'}
              </Button>
            </div>
          </Card>
        </div> */}
      </div>
    </motion.div>
  );
};

export default Account;