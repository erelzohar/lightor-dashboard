import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { setCodeFrameTexts } from '../../services/codeFrame';
import { loadPhoneCountries, setOwnerPhone } from '../../services/phoneCountries';

/**
 * LT-677: phone numbers outside Israel, for the whole app. Once someone is
 * signed in it asks the API which countries are open (once per page load;
 * Israel alone until it answers, and after any failure), and it keeps two
 * things current: the country of the owner's own phone, which is where an
 * empty phone field starts, and the words of the panel a code abroad may
 * show Google's check in. It draws nothing.
 */
const PhonesAbroad: React.FC = () => {
  const { auth } = useAuth();
  const { t } = useTranslation();
  const signedIn = !!auth.user;
  const phone = auth.user?.phone;

  useEffect(() => {
    if (signedIn) void loadPhoneCountries();
  }, [signedIn]);

  useEffect(() => {
    setOwnerPhone(phone);
  }, [phone]);

  useEffect(() => {
    setCodeFrameTexts({ title: t('phoneInput.checkTitle'), close: t('phoneInput.checkClose') });
  }, [t]);

  return null;
};

export default PhonesAbroad;
