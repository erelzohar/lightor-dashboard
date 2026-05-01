import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Clock, StoreIcon, RefreshCcw, MapPin, Phone, Mail, Image as ImageIcon, Settings as SettingsIcon, CalendarClock, Instagram, Facebook, X, Music2, AlertCircle, Copy, Check } from 'lucide-react'; import { WebConfig } from '../types';
import { checkSubdomainAvailability } from '../services/webConfigApi';
// import { getWebConfigById, updateWebConfig } from '../services/webConfigApi';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import WebConfigTabs from '../components/settings/WebConfigTabs';
import toast from 'react-hot-toast';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { useAuth } from '../contexts/AuthContext';
import globals from '../services/globals';
import { uploadImage } from '../services/imagesApi';
import FieldTooltip from '../components/settings/FieldTooltip';
import Select from '../components/ui/Select';

const Settings: React.FC = () => {
  const [localWebConfig, setLocalWebConfig] = useState<WebConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [imageToUpload, setImageToUpload] = useState<File>(null);
  const [errors, setErrors] = useState<Record<string, string | null>>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { updatePalette, language } = useTheme();
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const webConfig = useAppSelector(state => state.webConfig.data);

  const hasChanges = () => {
    if (!localWebConfig || !webConfig) return false;
    const settingsChanged = JSON.stringify(localWebConfig.address) !== JSON.stringify(webConfig.address) ||
      // JSON.stringify(localWebConfig.minsPerSlot) !== JSON.stringify(webConfig.minsPerSlot) ||
      JSON.stringify(localWebConfig.minCancelTimeMS) !== JSON.stringify(webConfig.minCancelTimeMS) ||
      JSON.stringify(localWebConfig.businessName) !== JSON.stringify(webConfig.businessName) ||
      JSON.stringify(localWebConfig.subDomain) !== JSON.stringify(webConfig.subDomain) ||
      JSON.stringify(localWebConfig.contact) !== JSON.stringify(webConfig.contact) ||
      JSON.stringify(localWebConfig.social) !== JSON.stringify(webConfig.social) ||
      JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig.components?.introPopup) ||
      imageToUpload;

    return settingsChanged;
  };

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  const changesDetected = hasChanges();

  useEffect(() => {
    const mainElement = document.querySelector('main');
    if (!mainElement) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsStuck(!entry.isIntersecting);
      },
      {
        threshold: 0,
        rootMargin: '0px 0px 0px 0px'
      }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [changesDetected]);



  useEffect(() => {
    document.title = language === "he" ? "הגדרות" : "Settings";
  }, [language]);
  const fetchWebConfigData = async () => {
    setIsLoading(true);
    try {
      await dispatch(fetchWebConfig(auth.user.webConfig_id));
    } catch (error) {
      toast.error(
        language === 'he'
          ? 'אירעה שגיאה בטעינת ההגדרות'
          : 'Failed to load settings'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!webConfig) fetchWebConfigData();
    else setIsLoading(false);
    if (!localWebConfig && webConfig) {
      // set image name to full url
      setLocalWebConfig({ ...webConfig, logoImageName: globals.imagesUrl + webConfig.logoImageName });
    }
  }, [webConfig]);

  const cancelMinutes = [
    30,
    60,      // 1 hour
    120,     // 2 hours
    180,     // 3 hours
    240,     // 4 hours
    360,     // 6 hours
    720,     // 12 hours
    1440,    // 1 day
    2880,    // 2 days
    4320,    // 3 days
    10080    // 1 week
  ];

  const formatTimeLabel = (min: number, lang: string) => {
    if (min < 60) {
      return `${min} ${lang === "he" ? "דקות" : "minutes"}`;
    }
    if (min < 1440) {
      return `${min / 60} ${lang === "he" ? "שעות" : "hours"}`;
    }
    return `${min / 1440} ${lang === "he" ? "ימים" : "days"}`;
  };

  const buildOptions = (minutesList: number[], lang: string, toMs = false) =>
    minutesList.map((min) => ({
      value: toMs ? min * 60000 : min,
      label: formatTimeLabel(min, lang),
    }));

  const cancellationOptions = buildOptions(cancelMinutes, language, true);


  const validationRules: Record<string, (value: any, language?: string) => string | null> = {
    businessName: (value, language) =>
      value.length < 2
        ? language === 'he'
          ? "שם העסק חייב להכיל לפחות 2 תווים"
          : "Business name must be at least 2 characters"
        : null,

    minCancelTimeMS: (value, language) =>
      value && (value < 300000)
        ? language === 'he'
          ? "זמן הביטול המינימלי חייב להיות לפחות 5 דקות"
          : "Minimum cancellation time must be at least 5 minutes"
        : null,

    state: (value, language) =>
      !value || value.trim().length < 2
        ? language === 'he'
          ? "יש להזין שם מדינה תקין (לפחות 2 תווים)"
          : "Please enter a valid state (at least 2 characters)"
        : null,

    city: (value, language) =>
      !value || value.trim().length < 2
        ? language === 'he'
          ? "יש להזין שם עיר תקין (לפחות 2 תווים)"
          : "Please enter a valid city (at least 2 characters)"
        : null,

    street: (value, language) =>
      !value || value.trim().length < 3
        ? language === 'he'
          ? "יש להזין שם רחוב תקין (לפחות 3 תווים)"
          : "Please enter a valid street (at least 3 characters)"
        : null,

    phone: (value, language) => {
      if (!value)
        return language === 'he'
          ? "יש להזין מספר טלפון"
          : "Phone number is required";
      if (!/^05\d{8}$/.test(value))
        return language === 'he'
          ? "מספר הטלפון חייב להתחיל ב־05 ולהכיל 10 ספרות בדיוק"
          : "Phone must start with '05' and be exactly 10 digits";
      return null;
    },

    mail: (value, language) =>
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        ? language === 'he'
          ? "כתובת האימייל אינה תקינה"
          : "Invalid email format"
        : null,

    instagram: (value, language) =>
      value && !value.startsWith("https://")
        ? language === 'he'
          ? "הקישור חייב להתחיל ב־https://"
          : "Must start with https://"
        : null,

    facebook: (value, language) =>
      value && !value.startsWith("https://")
        ? language === 'he'
          ? "הקישור חייב להתחיל ב־https://"
          : "Must start with https://"
        : null,

    x: (value, language) =>
      value && !value.startsWith("https://")
        ? language === 'he'
          ? "הקישור חייב להתחיל ב־https://"
          : "Must start with https://"
        : null,

    tiktok: (value, language) =>
      value && !value.startsWith("https://")
        ? language === 'he'
          ? "הקישור חייב להתחיל ב־https://"
          : "Must start with https://"
        : null,
  };


  const handleSave = async () => {
    if (!localWebConfig) return;

    // const newErrors: Record<string, string | null> = {};
    // for (const key in validationRules) {
    //   const value = (localWebConfig as any)[key] ||
    //     (localWebConfig.contact as any)?.[key] ||
    //     (localWebConfig.social as any)?.[key];
    //   console.log(key, value);

    //   const validate = validationRules[key];
    //   if (validate) newErrors[key] = validate(value, language);
    // }

    // setErrors(newErrors);

    // const hasErrors = Object.values(newErrors).some((e) => e);
    if (errors) {
      toast.error(language === 'he' ? 'הטופס מכיל שגיאות' : 'The form contains errors');
      return;
    }

    setIsSaving(true);
    try {
      let imgResponse;
      if (imageToUpload) {
        imgResponse = await uploadImage(imageToUpload);
        if (!imgResponse) throw new Error("Failed to upload image");
      }

      const { _id, businessName, subDomain, address, minCancelTimeMS, social, contact } = localWebConfig;

      const fixedSocials = { ...social };
      fixedSocials.facebook = social.facebook === "" ? null : social.facebook;
      fixedSocials.instagram = social.instagram === "" ? null : social.instagram;
      fixedSocials.tiktok = social.tiktok === "" ? null : social.tiktok;
      fixedSocials.x = social.x === "" ? null : social.x;

      const payload: any = { _id, businessName, subDomain, address, minCancelTimeMS, social: fixedSocials, contact };
      if (imgResponse) {
        payload.logoImageName = imgResponse.imageName;
      }

      // Include introPopup if changed
      if (JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig?.components?.introPopup)) {
        payload.components = {
          ...webConfig?.components,
          introPopup: localWebConfig.components?.introPopup,
        };
      }

      const res = await dispatch(updateWebConfig(payload));
      if (updateWebConfig.rejected.match(res)) {
        toast.error(language === 'he' ? 'אירעה שגיאה בשמירת ההגדרות' : 'Failed to save settings');
        return;
      }
      setImageToUpload(null);
      toast.success(
        language === 'he'
          ? 'ההגדרות נשמרו בהצלחה'
          : 'Settings saved successfully'
      );
    } catch (error) {
      console.log(error);

      toast.error(
        language === 'he'
          ? 'אירעה שגיאה בשמירת ההגדרות'
          : 'Failed to save settings'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (section: string, field: string, value: any) => {
    if (!localWebConfig) return;

    const fieldKey = field;
    const validate = validationRules[fieldKey];
    if (validate) {
      const errorMsg = validate(value, language);
      if (errorMsg) setErrors(prev => ({ ...prev, [fieldKey]: errorMsg }));
      else if (errors) setErrors(prev => {
        delete prev[fieldKey];
        if (Object.keys(prev).length === 0) return null;
        return { ...prev };
      })
    }
    setLocalWebConfig(prev => {
      if (!prev) return prev;

      if (section === 'root') {
        return { ...prev, [field]: value };
      }

      if (section.includes('.')) {
        const [parentSection, childSection] = section.split('.');
        return {
          ...prev,
          [parentSection]: {
            ...prev[parentSection as keyof WebConfig],
            [childSection]: {
              ...(prev as any)[parentSection][childSection],
              [field]: value
            }
          }
        };
      }

      return {
        ...prev,
        [section]: {
          ...prev[section as keyof WebConfig],
          [field]: value
        }
      };
    });
  };

  const handleColorChange = (colorKey: keyof WebConfig['pallete'], value: string) => {
    if (!webConfig) return;

    setWebConfig(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        pallete: {
          ...prev.pallete,
          [colorKey]: value
        }
      };
    });
  };

  if (isLoading || !webConfig || !localWebConfig) {
    return (
      <div className="flex justify-center items-center h-96">
        <RefreshCcw className="animate-spin text-primary h-8 w-8" />
      </div>
    );
  }
  const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
    <div className="flex items-center gap-2 pb-2 mb-4">
      <Icon className="text-primary w-5 h-5" />
      <h3 className="font-semibold text-lg text-gray-800 dark:text-white">{title}</h3>
    </div>
  );
  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <SectionHeader icon={SettingsIcon} title={language === "he" ? "הגדרות כלליות" : "General Settings"} />
            <div className="flex flex-col items-center gap-3">
              <h3>{language === "he" ? "לוגו" : "Logo"}</h3>
              {localWebConfig.logoImageName ? (
                <img
                  src={localWebConfig.logoImageName}
                  alt="Logo"
                  className="h-20 w-20 rounded-full object-contain border border-light-gray shadow-sm"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-light-surface border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                  {language === 'he' ? 'אין לוגו' : 'No Logo'}
                </div>
              )}

              <label
                htmlFor="logo-upload"
                className="cursor-pointer bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-primary/90 transition text-sm font-medium flex"
              >
                {language === 'he' ? 'בחר תמונת לוגו' : 'Upload Logo'}
                &nbsp;
                <ImageIcon width={15} />
              </label>

              <input
                id="logo-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setImageToUpload(file);
                      handleChange('root', 'logoImageName', reader.result);
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>


            {/* Elegant Subdomain Section */}
            <div className="mb-8 bg-gray-50/30 dark:bg-gray-800/20 rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/60 transition-all hover:border-gray-300 dark:hover:border-gray-600">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                <div className="flex-1">
                  <label className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                    <span>{language === 'he' ? 'הלינק שלך (Subdomain)' : 'Your Link (Subdomain)'}</span>
                    {(isCheckingSubdomain || (localWebConfig.subDomain !== webConfig?.subDomain && !subdomainError && (localWebConfig.subDomain?.length ?? 0) >= 2)) && (
                      <span className="text-secondary text-xs flex items-center gap-1 md:hidden">
                        {isCheckingSubdomain ? (
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin text-primary" />
                        ) : (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </span>
                    )}
                  </label>
                  <p className="text-[0.8125rem] text-gray-500 dark:text-gray-400 mb-0 md:mb-2 ms-0.5 max-w-md">
                    {language === 'he'
                      ? 'זהו הקישור הישיר לעמוד שלך שתוכל לשתף עם לקוחותיך.'
                      : 'This is the direct link to your business page that you can share with your clients.'}
                  </p>
                </div>
                
                <div className="w-full md:w-1/2 flex-none relative">
                  {(isCheckingSubdomain || (localWebConfig.subDomain !== webConfig?.subDomain && !subdomainError && (localWebConfig.subDomain?.length ?? 0) >= 2)) && (
                    <div className="hidden md:flex absolute -top-6 end-0 text-secondary text-xs items-center gap-1">
                      {isCheckingSubdomain ? (
                        <>
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin text-primary" />
                          {language === 'he' ? 'בודק זמינות...' : 'Checking...'}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-green-500 font-medium">{language === 'he' ? 'זמין' : 'Available'}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div dir="ltr" className={`w-full flex items-stretch rounded-xl border ${subdomainError ? 'border-red-300 dark:border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20' : 'border-gray-200 dark:border-gray-700/80 focus-within:border-primary focus-within:ring-primary/20'} focus-within:ring-[0.1875rem] transition-all duration-300 bg-white dark:bg-dark-surface shadow-sm overflow-hidden`}>
                  <input
                    type="text"
                    className="flex-1 min-w-0 px-4 py-3 bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none text-start text-[0.9375rem] placeholder-gray-400 dark:placeholder-gray-500"
                    value={localWebConfig.subDomain || ''}
                    onChange={(e) => {
                      const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
                      handleChange('root', 'subDomain', value);

                      if (debounceTimeoutRef.current) {
                        clearTimeout(debounceTimeoutRef.current);
                      }

                      if (value.length < 2 || value.length > 20) {
                        setSubdomainError(language === 'he' ? 'הלינק חייב להכיל בין 2 ל-20 תווים' : 'Link must be between 2 and 20 characters');
                        setIsCheckingSubdomain(false);
                      } else if (value !== webConfig?.subDomain && value.length >= 2) {
                        setIsCheckingSubdomain(true);
                        setSubdomainError(null);

                        debounceTimeoutRef.current = setTimeout(async () => {
                          try {
                            const isAvailable = await checkSubdomainAvailability(value);
                            if (!isAvailable) {
                              setSubdomainError(language === 'he' ? 'שם האתר אינו זמין' : 'This subdomain is not available');
                            }
                          } catch (error) {
                            setSubdomainError(language === 'he' ? 'שגיאה בבדיקת זמינות' : 'Error checking availability');
                          } finally {
                            setIsCheckingSubdomain(false);
                          }
                        }, 500);
                      } else {
                        setIsCheckingSubdomain(false);
                        setSubdomainError(null);
                      }
                    }}
                    placeholder={language === 'he' ? 'your-site' : 'your-site'}
                  />
                  <span className="flex items-center px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 text-[0.9375rem] border-s border-gray-200 dark:border-gray-700/80 whitespace-nowrap">
                    .lightor.app
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const url = `https://${localWebConfig.subDomain || ''}.lightor.app`;
                      navigator.clipboard.writeText(url);
                      toast.success(language === 'he' ? 'הקישור הועתק!' : 'Link copied!');
                    }}
                    className="flex items-center justify-center px-4 text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-s border-gray-200 dark:border-gray-700/80 transition-colors"
                    title={language === 'he' ? 'העתק קישור' : 'Copy link'}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <AnimatePresence mode="popLayout">
                  {subdomainError && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-2 text-sm font-medium text-red-500 text-start"
                    >
                      {subdomainError}
                    </motion.p>
                  )}
                  {localWebConfig.subDomain !== webConfig?.subDomain && !subdomainError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0, marginTop: 0 }}
                      animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
                      exit={{ opacity: 0, height: 0, marginTop: 0 }}
                      className="overflow-hidden"
                    >
                      <p className="text-[0.8125rem] text-orange-500 dark:text-orange-400 text-start flex items-start gap-1.5 font-medium bg-orange-50 dark:bg-orange-900/10 p-2.5 rounded-lg border border-orange-100 dark:border-orange-500/20">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          {language === 'he' 
                            ? 'שימו לב: שינוי הקישור יגרום לכך שהקישור הקודם שלכם כבר לא יהיה זמין.'
                            : 'Note: Changing the link means your previous link will no longer be available.'}
                        </span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={
                  <>
                    {language === 'he' ? 'שם העסק' : 'Business Name'}
                    <FieldTooltip
                      title={language === 'he' ? 'שם העסק' : 'Business Name'}
                      description={language === 'he'
                        ? "השם שיופיע בראש אתר ההזמנות , במערכת קביעת התורים והודעות"
                        : "The name that will apear in the head of the scheduling site , the appointment system and messages."}
                    />
                  </>
                }
                leftIcon={<StoreIcon className="w-4 h-4 text-gray-400" />}
                value={localWebConfig.businessName}
                error={errors?.businessName}
                onChange={(e) => handleChange('root', 'businessName', e.target.value)}
              />

              <Select
                label={
                  <>
                    {language === "he"
                      ? "זמן מינימלי לעדכון תור"
                      : "Appointments Minimum Cancellation Time"}

                    <FieldTooltip
                      title={
                        language === "he"
                          ? "זמן מינימלי לעדכון תור"
                          : "Appointments Minimum Update Time"
                      }
                      description={
                        language === "he"
                          ? "בחר כמה זמן לפני מועד התור הלקוחות שלך יוכלו לבטל או לעדכן את התור"
                          : "Choose the amount of time before the appointment that clients may update"
                      }
                    />
                  </>
                }
                leftIcon={<Clock className="w-4 h-4 text-gray-400" />}
                value={localWebConfig.minCancelTimeMS}
                options={cancellationOptions}
                onChange={(e) =>
                  handleChange("root", "minCancelTimeMS", Number(e.target.value))
                }
                error={errors?.minCancelTimeMS}
              />
            </div>

            {/* <div>
              <label className="block text-sm font-medium text-light-text mb-2">
                {language === 'he' ? 'שפת ברירת מחדל' : 'Default Language'}
              </label>
              <div className="flex space-x-4">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-primary"
                    name="defaultLanguage"
                    value="he"
                    checked={localWebConfig.defaultLanguage === 'he'}
                    onChange={(e) => handleChange('root', 'defaultLanguage', e.target.value)}
                  />
                  <span className="ml-2">{language === 'he' ? 'עברית' : 'Hebrew'}</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    className="form-radio text-primary"
                    name="defaultLanguage"
                    value="en"
                    checked={localWebConfig.defaultLanguage === 'en'}
                    onChange={(e) => handleChange('root', 'defaultLanguage', e.target.value)}
                  />
                  <span className="ml-2">{language === 'he' ? 'אנגלית' : 'English'}</span>
                </label>
              </div>
            </div> */}
            {/* Intro Popup Message */}
            <div className="mt-6 p-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/30 dark:bg-gray-800/20 space-y-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {language === 'he' ? 'הודעה קופצת' : 'Popup Message'}
                  </h3>
                  <FieldTooltip
                    title={language === 'he' ? 'הודעה קופצת' : 'Popup Message'}
                    description={language === 'he'
                      ? 'הודעה שתוצג ללקוחות כשהם נכנסים לאתר ההזמנות שלך. שימושי להודעות על חופשות, שינויים בשעות פעילות וכו\''
                      : 'A message that will be shown to clients when they visit your booking site. Useful for vacation notices, schedule changes, etc.'}
                  />
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={localWebConfig.components?.introPopup?.visible ?? false}
                    onChange={(e) => handleChange('components.introPopup', 'visible', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-300 dark:bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[0.125rem] after:start-[0.125rem] after:bg-white dark:after:bg-gray-100 after:border-gray-300 dark:after:border-dark-gray/50 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary dark:peer-checked:bg-primary-dark"></div>
                  <span className="ms-2 text-sm text-light-text">
                    {localWebConfig.components?.introPopup?.visible
                      ? (language === 'he' ? 'פעיל' : 'Active')
                      : (language === 'he' ? 'כבוי' : 'Off')}
                  </span>
                </label>
              </div>

              <textarea
                value={localWebConfig.components?.introPopup?.value ?? ''}
                onChange={(e) => handleChange('components.introPopup', 'value', e.target.value)}
                rows={3}
                placeholder={language === 'he' ? 'כתוב כאן את ההודעה שתוצג ללקוחות...' : 'Write the message to display to clients...'}
                className="w-full bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl px-4 py-3 text-[0.9375rem] border border-yellow-200/60 dark:border-yellow-700/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] focus:ring-yellow-500/20 focus:border-yellow-400 dark:focus:border-yellow-500 transition-all duration-300 resize-none shadow-sm"
              />
            </div>

          </motion.div>
        );

      // case 'theme':
      //   return (
      //     <div className="space-y-6">
      //       <h3 className="font-semibold">
      //         {language === 'he' ? 'צבעי המערכת' : 'System Colors'}
      //       </h3>

      //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      //         <ColorPicker
      //           color={localWebConfig.pallete.colorPrimary}
      //           onChange={(color) => handleColorChange('colorPrimary', color)}
      //           label={language === 'he' ? 'צבע ראשי' : 'Primary Color'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorPrimaryDark}
      //           onChange={(color) => handleColorChange('colorPrimaryDark', color)}
      //           label={language === 'he' ? 'צבע ראשי כהה' : 'Primary Dark Color'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorLightBg}
      //           onChange={(color) => handleColorChange('colorLightBg', color)}
      //           label={language === 'he' ? 'רקע בהיר' : 'Light Background'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorLightSurface}
      //           onChange={(color) => handleColorChange('colorLightSurface', color)}
      //           label={language === 'he' ? 'משטח בהיר' : 'Light Surface'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorLightGray}
      //           onChange={(color) => handleColorChange('colorLightGray', color)}
      //           label={language === 'he' ? 'אפור בהיר' : 'Light Gray'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorLightText}
      //           onChange={(color) => handleColorChange('colorLightText', color)}
      //           label={language === 'he' ? 'טקסט בהיר' : 'Light Text'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorDarkBg}
      //           onChange={(color) => handleColorChange('colorDarkBg', color)}
      //           label={language === 'he' ? 'רקע כהה' : 'Dark Background'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorDarkSurface}
      //           onChange={(color) => handleColorChange('colorDarkSurface', color)}
      //           label={language === 'he' ? 'משטח כהה' : 'Dark Surface'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorDarkGray}
      //           onChange={(color) => handleColorChange('colorDarkGray', color)}
      //           label={language === 'he' ? 'אפור כהה' : 'Dark Gray'}
      //         />

      //         <ColorPicker
      //           color={localWebConfig.pallete.colorDarkText}
      //           onChange={(color) => handleColorChange('colorDarkText', color)}
      //           label={language === 'he' ? 'טקסט כהה' : 'Dark Text'}
      //         />
      //       </div>
      //     </div>
      //   );

      // case 'schedule':
      //   return (
      //     <div className="space-y-6">
      //       <h3 className="font-semibold">
      //         {language === 'he' ? 'תזמון פגישות' : 'Appointment Scheduling'}
      //       </h3>

      //       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      //         <Input
      //           label={language === 'he' ? 'כותרת' : 'Title'}
      //           value={localWebConfig.components.schedule.title}
      //           onChange={(e) => handleChange('components.schedule', 'title', e.target.value)}
      //         />

      //         <Input
      //           label={language === 'he' ? 'תיאור' : 'Description'}
      //           value={localWebConfig.components.schedule.description}
      //           onChange={(e) => handleChange('components.schedule', 'description', e.target.value)}
      //         />


      //       </div>

      //       <div>
      //         <h4 className="font-medium mb-2">
      //           {language === 'he' ? 'שעות עבודה' : 'Working Hours'}
      //         </h4>
      //         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      //           {['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'].map((day, index) => (
      //             <div key={index} className="border border-light-gray rounded-md p-4">
      //               <label className="block text-sm font-medium text-light-text mb-2">
      //                 {day}
      //               </label>
      //               <Input
      //                 placeholder="10:00-18:00"
      //                 value={localWebConfig.workingDays[index] || ''}
      //                 onChange={(e) => {
      //                   const newWorkingDays = [...localWebConfig.workingDays];
      //                   newWorkingDays[index] = e.target.value || null;
      //                   handleChange('root', 'workingDays', newWorkingDays);
      //                 }}
      //               />
      //             </div>
      //           ))}
      //         </div>
      //       </div>
      //     </div>
      //   );

      case 'address':
        return (
          <div className="space-y-6">
            <SectionHeader icon={MapPin} title={language === 'he' ? 'כתובת ומיקום' : 'Business Address'} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={language === 'he' ? 'מדינה' : 'State/Country'}
                value={localWebConfig.address.state}
                error={errors?.state}
                onChange={(e) => handleChange('address', 'state', e.target.value)}
              />

              <Input
                label={language === 'he' ? 'עיר' : 'City'}
                error={errors?.city}
                value={localWebConfig.address.city}
                onChange={(e) => handleChange('address', 'city', e.target.value)}
              />

              <Input
                label={language === 'he' ? 'רחוב ומספר' : 'Street'}
                error={errors?.street}
                value={localWebConfig.address.street}
                onChange={(e) => handleChange('address', 'street', e.target.value)}
              />

              <Input
                label={language === 'he' ? 'פרטים נוספים' : 'Additional Details'}
                value={localWebConfig.address.other || ''}
                onChange={(e) => handleChange('address', 'other', e.target.value)}
              />
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-6">
            <div>
              <SectionHeader icon={Phone} title={language === 'he' ? 'פרטי יצירת קשר' : 'Contact Information'} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label={language === 'he' ? 'טלפון' : 'Phone'}
                  value={localWebConfig.contact.phone}
                  minLength={10}
                  maxLength={10}
                  error={errors?.phone}
                  leftIcon={<Phone className="w-4 h-4 text-gray-400" />}
                  onChange={(e) => handleChange('contact', 'phone', e.target.value)}
                />

                <Input
                  label={language === 'he' ? 'אימייל' : 'Email'}
                  leftIcon={<Mail className="w-4 h-4 text-gray-400" />}
                  type="email"
                  error={errors?.email}
                  value={localWebConfig.contact.mail || ''}
                  onChange={(e) => handleChange('contact', 'mail', e.target.value)}
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-4">
                {language === 'he' ? 'רשתות חברתיות' : 'Social Media'}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  placeholder='https://www.instagram.com'
                  type='url'
                  label="Instagram"
                  error={errors?.instagram}
                  leftIcon={<Instagram className="w-4 h-4 text-gray-400" />}
                  value={localWebConfig.social.instagram || ''}
                  onChange={(e) => handleChange('social', 'instagram', e.target.value)}
                />

                <Input
                  label="Facebook"
                  error={errors?.facebook}
                  placeholder='https://www.facebook.com'
                  leftIcon={<Facebook className="w-4 h-4 text-gray-400" />}
                  value={localWebConfig.social.facebook || ''}
                  onChange={(e) => handleChange('social', 'facebook', e.target.value)}
                />

                <Input
                  label="X / Twitter"
                  error={errors?.x}
                  placeholder='https://www.x.com'
                  leftIcon={<X className="w-4 h-4 text-gray-500" />}
                  value={localWebConfig.social.x || ''}
                  onChange={(e) => handleChange('social', 'x', e.target.value)}
                />

                <Input
                  label="TikTok"
                  type='url'
                  error={errors?.tiktok}
                  placeholder='https://www.tiktok.com'
                  leftIcon={<Music2 className="w-4 h-4 text-gray-400" />}
                  value={localWebConfig.social.tiktok || ''}
                  onChange={(e) => handleChange('social', 'tiktok', e.target.value)}
                />
              </div>
            </div>
          </div>
        );

      // case 'components':
      //   return (
      //     <div className="space-y-6">
      //       <div>
      //         <h3 className="font-semibold mb-4">
      //           {language === 'he' ? 'הגדרות ראשיות' : 'Main Settings'}
      //         </h3>

      //         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      //           <div>
      //             <h4 className="font-medium mb-3">
      //               {language === 'he' ? 'תפריט ניווט' : 'Navigation'}
      //             </h4>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.navbar.visible}
      //                 onChange={(e) => handleChange('components.navbar', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג תפריט ניווט' : 'Show Navbar'}
      //               </span>
      //             </label>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.navbar.darkMode}
      //                 onChange={(e) => handleChange('components.navbar', 'darkMode', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'תפריט בצבעים כהים' : 'Dark Mode Navbar'}
      //               </span>
      //             </label>
      //             <label className="flex items-center">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.navbar.languageSwitcher}
      //                 onChange={(e) => handleChange('components.navbar', 'languageSwitcher', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג בורר שפה' : 'Show Language Switcher'}
      //               </span>
      //             </label>
      //           </div>

      //           <div>
      //             <h4 className="font-medium mb-3">
      //               {language === 'he' ? 'רכיבי תצוגה' : 'Display Components'}
      //             </h4>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.hero.visible}
      //                 onChange={(e) => handleChange('components.hero', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג סקשן ראשי' : 'Show Hero Section'}
      //               </span>
      //             </label>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.about.visible}
      //                 onChange={(e) => handleChange('components.about', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג אודות' : 'Show About Section'}
      //               </span>
      //             </label>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.portfolio.visible}
      //                 onChange={(e) => handleChange('components.portfolio', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג גלריה' : 'Show Portfolio'}
      //               </span>
      //             </label>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.contact.visible}
      //                 onChange={(e) => handleChange('components.contact', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג צור קשר' : 'Show Contact Form'}
      //               </span>
      //             </label>
      //           </div>
      //         </div>
      //       </div>

      //       <div>
      //         <h3 className="font-semibold mb-4">
      //           {language === 'he' ? 'הגדרות נוספות' : 'Additional Settings'}
      //         </h3>
      //         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      //           <div>
      //             <h4 className="font-medium mb-3">
      //               {language === 'he' ? 'חלון קופץ' : 'Popup Settings'}
      //             </h4>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.introPopup.visible}
      //                 onChange={(e) => handleChange('components.introPopup', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג חלון קופץ' : 'Show Popup'}
      //               </span>
      //             </label>
      //             <Input
      //               label={language === 'he' ? 'תוכן החלון הקופץ' : 'Popup Content'}
      //               value={localWebConfig.components.introPopup.value}
      //               onChange={(e) => handleChange('components.introPopup', 'value', e.target.value)}
      //             />
      //           </div>

      //           <div>
      //             <h4 className="font-medium mb-3">
      //               {language === 'he' ? 'כפתור יצירת קשר' : 'Contact Button'}
      //             </h4>
      //             <label className="flex items-center mb-2">
      //               <input
      //                 type="checkbox"
      //                 className="mr-2"
      //                 checked={localWebConfig.components.contactButton.visible}
      //                 onChange={(e) => handleChange('components.contactButton', 'visible', e.target.checked)}
      //               />
      //               <span>
      //                 {language === 'he' ? 'הצג כפתור יצירת קשר' : 'Show Contact Button'}
      //               </span>
      //             </label>
      //           </div>
      //         </div>
      //       </div>
      //     </div>
      //   );

      default:
        return (
          <div className="py-8 text-center">
            <p className="text-light-gray">
              {language === 'he' ? 'בחר קטגוריה מלמעלה' : 'Select a tab above'}
            </p>
          </div>
        );
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <SettingsIcon className="text-primary w-5 h-5" />
            <h1 className="font-semibold text-xl text-gray-800 dark:text-white">
              {language === 'he' ? 'הגדרות כלליות' : 'Settings'}
            </h1>
          </div>
          <p className="text-light-text dark:text-gray-400 text-sm mt-1">
            {language === 'he'
              ? 'התאם את ההגדרות של האתר שלך'
              : 'Customize your website settings'
            }
          </p>
        </div>

        {/* Desktop Save Bar (Hidden on Mobile) */}
        <div className="hidden md:block">
          <AnimatePresence>
            {changesDetected && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-4"
              >
                <div className="flex items-center gap-2">
                  <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
                  <span className="text-sm text-orange-700 dark:text-orange-300 font-medium whitespace-nowrap">
                    {language === 'he' ? 'יש לך שינויים שלא נשמרו' : 'You have unsaved changes'}
                  </span>
                </div>
                <Button
                  onClick={handleSave}
                  rightIcon={<Save size={18} />}
                  isLoading={isSaving || isCheckingSubdomain}
                  disabled={isSaving || isCheckingSubdomain || !!subdomainError}
                  size="sm"
                >
                  {language === 'he' ? 'שמור' : 'Save'}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Mobile Sticky Save Bar Container */}
      <div className="md:hidden relative z-[40]">
        <div ref={sentinelRef} className="absolute w-full h-px invisible" />
        <AnimatePresence>
          {changesDetected && !isStuck && (
            <motion.div
              layout
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 16 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden"
            >
              <div className="relative z-50 bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
                    <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                      {language === 'he' ? 'יש לך שינויים שלא נשמרו' : 'You have unsaved changes'}
                    </span>
                  </div>
                  <Button
                    onClick={handleSave}
                    rightIcon={<Save size={18} />}
                    isLoading={isSaving || isCheckingSubdomain}
                    disabled={isSaving || isCheckingSubdomain || !!subdomainError}
                    size="md"
                  >
                    {language === 'he' ? 'שמור' : 'Save'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {changesDetected && isStuck && typeof document !== 'undefined' && createPortal(
          <div className="md:hidden fixed top-0 left-0 right-0 z-[40] bg-white/95 dark:bg-dark-bg backdrop-blur-md shadow-md border-b border-orange-200 dark:border-orange-900/50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
                <span className="text-sm text-orange-700 dark:text-orange-300 font-medium">
                  {language === 'he' ? 'יש לך שינויים שלא נשמרו' : 'You have unsaved changes'}
                </span>
              </div>
              <Button
                onClick={handleSave}
                rightIcon={<Save size={18} />}
                isLoading={isSaving || isCheckingSubdomain}
                disabled={isSaving || isCheckingSubdomain || !!subdomainError}
                size="md"
              >
                {language === 'he' ? 'שמור' : 'Save'}
              </Button>
            </div>
          </div>,
          document.body
        )}
      </div>

      <motion.div layout transition={{ duration: 0.3, ease: "easeOut" }}>
        <Card className='shadow-xl'>
          <WebConfigTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="my-6">
            {renderTabContent()}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default Settings;