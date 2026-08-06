import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Clock, StoreIcon, RefreshCcw, MapPin, Phone, Mail, Image as ImageIcon, Settings as SettingsIcon, CalendarClock, Instagram, Facebook, X, Music2, AlertCircle, Copy, Check } from 'lucide-react';
import { WebConfig, Address } from '../types';
import { checkSubdomainAvailability } from '../services/webConfigApi';
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
import { useTranslation } from 'react-i18next';

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [localWebConfig, setLocalWebConfig] = useState<WebConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [imageToUpload, setImageToUpload] = useState<File>(null);
  const [logoInputMode, setLogoInputMode] = useState<'upload' | 'url'>('upload');
  const [logoUrlValue, setLogoUrlValue] = useState('');
  const [logoUrlError, setLogoUrlError] = useState<string | null>(null);
  const [logoPreviewError, setLogoPreviewError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>(null);
  const [isCheckingSubdomain, setIsCheckingSubdomain] = useState(false);
  const [subdomainError, setSubdomainError] = useState<string | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { updatePalette } = useTheme();
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const webConfig = useAppSelector(state => state.webConfig.data);

  const resolveLogoUrl = (imgName: string): string => {
    if (!imgName) return '';
    if (imgName.startsWith('http') || imgName.startsWith('data:') || imgName.startsWith('blob:')) return imgName;
    return globals.imagesUrl + imgName;
  };

  const hasChanges = () => {
    if (!localWebConfig || !webConfig) return false;
    const originalLogoUrl = resolveLogoUrl(webConfig.logoImageName);
    // The local copy always carries a full address shape (see hydration above),
    // while the server may have sent none at all. Compare only the meaningful
    // values, or an untouched form would report unsaved changes forever.
    const meaningfulAddress = (a?: Address) =>
      JSON.stringify(
        Object.fromEntries(
          (['state', 'city', 'street', 'other'] as const)
            .map((k) => [k, a?.[k]?.trim() ?? ''])
            .filter(([, v]) => v)
        )
      );

    const settingsChanged = meaningfulAddress(localWebConfig.address) !== meaningfulAddress(webConfig.address) ||
      JSON.stringify(localWebConfig.minCancelTimeMS) !== JSON.stringify(webConfig.minCancelTimeMS) ||
      JSON.stringify(localWebConfig.businessName) !== JSON.stringify(webConfig.businessName) ||
      JSON.stringify(localWebConfig.subDomain) !== JSON.stringify(webConfig.subDomain) ||
      JSON.stringify(localWebConfig.contact) !== JSON.stringify(webConfig.contact) ||
      JSON.stringify(localWebConfig.social) !== JSON.stringify(webConfig.social) ||
      JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig.components?.introPopup) ||
      imageToUpload ||
      (logoInputMode === 'url' && localWebConfig.logoImageName !== originalLogoUrl);

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
      { threshold: 0, rootMargin: '0px 0px 0px 0px' }
    );

    if (sentinelRef.current) {
      observer.observe(sentinelRef.current);
    }

    return () => observer.disconnect();
  }, [changesDetected]);

  useEffect(() => {
    document.title = t('settings.title');
  }, [t]);

  const fetchWebConfigData = async () => {
    setIsLoading(true);
    try {
      await dispatch(fetchWebConfig(auth.user.webConfig_id));
    } catch (error) {
      toast.error(t('settings.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!webConfig) fetchWebConfigData();
    else setIsLoading(false);
    if (!localWebConfig && webConfig) {
      setLocalWebConfig({
        ...webConfig,
        // The API omits `address` entirely for a business with no premises, but
        // this form needs all four inputs to stay controlled. Give it an empty
        // shape to edit rather than reading `.state` off undefined.
        address: { state: '', city: '', street: '', other: '', ...(webConfig.address ?? {}) },
        logoImageName: resolveLogoUrl(webConfig.logoImageName),
      });
      if (webConfig.logoImageName?.startsWith('http')) {
        setLogoInputMode('url');
        setLogoUrlValue(webConfig.logoImageName);
      }
    }
  }, [webConfig]);

  const cancelMinutes = [30, 60, 120, 180, 240, 360, 720, 1440, 2880, 4320, 10080];

  const formatTimeLabel = (min: number) => {
    if (min < 60) return `${min} ${t('time.minutes')}`;
    if (min < 1440) return `${min / 60} ${t('time.hours')}`;
    return `${min / 1440} ${t('time.days')}`;
  };

  const buildOptions = (minutesList: number[], toMs = false) =>
    minutesList.map((min) => ({
      value: toMs ? min * 60000 : min,
      label: formatTimeLabel(min),
    }));

  const cancellationOptions = buildOptions(cancelMinutes, true);

  const validationRules: Record<string, (value: any) => string | null> = {
    businessName: (value) =>
      value.length < 2 ? t('validation.businessNameMin') : null,

    minCancelTimeMS: (value) =>
      value && value < 300000 ? t('validation.minCancelTimeMin') : null,

    // Address is optional end-to-end — a business may have no premises, and the
    // API stores only the parts that carry a value. So an empty field is valid;
    // these only guard against something too short to be a real answer. Without
    // this, clearing an address field left the form permanently unsaveable.
    state: (value) =>
      value?.trim() && value.trim().length < 2 ? t('validation.stateMin') : null,

    city: (value) =>
      value?.trim() && value.trim().length < 2 ? t('validation.cityMin') : null,

    street: (value) =>
      value?.trim() && value.trim().length < 3 ? t('validation.streetMin') : null,

    phone: (value) => {
      if (!value) return t('validation.phoneRequired');
      if (!/^05\d{8}$/.test(value)) return t('validation.phoneFormat');
      return null;
    },

    mail: (value) =>
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? t('validation.emailInvalid') : null,

    instagram: (value) =>
      value && !value.startsWith("https://") ? t('validation.mustStartWithHttps') : null,

    facebook: (value) =>
      value && !value.startsWith("https://") ? t('validation.mustStartWithHttps') : null,

    x: (value) =>
      value && !value.startsWith("https://") ? t('validation.mustStartWithHttps') : null,

    tiktok: (value) =>
      value && !value.startsWith("https://") ? t('validation.mustStartWithHttps') : null,
  };

  const handleSave = async () => {
    if (!localWebConfig) return;

    if (errors) {
      toast.error(t('settings.formErrors'));
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
      } else if (logoInputMode === 'url' && logoUrlValue && logoUrlValue.startsWith('http')) {
        payload.logoImageName = logoUrlValue;
      }

      if (JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig?.components?.introPopup)) {
        payload.components = {
          ...webConfig?.components,
          introPopup: localWebConfig.components?.introPopup,
        };
      }

      const res = await dispatch(updateWebConfig(payload));
      if (updateWebConfig.rejected.match(res)) {
        toast.error(t('settings.saveFailed'));
        return;
      }
      setImageToUpload(null);
      setLogoUrlValue('');
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      console.log(error);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (section: string, field: string, value: any) => {
    if (!localWebConfig) return;

    const fieldKey = field;
    const validate = validationRules[fieldKey];
    if (validate) {
      const errorMsg = validate(value);
      if (errorMsg) setErrors(prev => ({ ...prev, [fieldKey]: errorMsg }));
      else if (errors) setErrors(prev => {
        delete prev[fieldKey];
        if (Object.keys(prev).length === 0) return null;
        return { ...prev };
      });
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

  const UnsavedBar = () => (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <AlertCircle size={16} className="text-orange-600 dark:text-orange-400" />
        <span className="text-sm text-orange-700 dark:text-orange-300 font-medium whitespace-nowrap">
          {t('common.unsavedChanges')}
        </span>
      </div>
      <Button
        onClick={handleSave}
        rightIcon={<Save size={18} />}
        isLoading={isSaving || isCheckingSubdomain}
        disabled={isSaving || isCheckingSubdomain || !!subdomainError}
        size="sm"
        className="ms-4"
      >
        {t('common.save')}
      </Button>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <SectionHeader icon={SettingsIcon} title={t('settings.generalSettings')} />
            <div className="flex flex-col items-center gap-3">
              <h3>{t('settings.logo')}</h3>

              {/* Logo preview */}
              {localWebConfig.logoImageName && !logoPreviewError ? (
                <img
                  src={localWebConfig.logoImageName}
                  alt="Logo"
                  className="h-20 w-20 rounded-full object-contain border border-light-gray shadow-sm"
                  onError={() => setLogoPreviewError(true)}
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-light-surface border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-sm">
                  {t('settings.noLogo')}
                </div>
              )}

              {/* Mode toggle */}
              <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 w-fit text-sm">
                <button
                  type="button"
                  onClick={() => { setLogoInputMode('upload'); setLogoUrlError(null); }}
                  className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5 ${logoInputMode === 'upload' ? 'bg-primary text-white' : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  <ImageIcon width={13} />
                  {t('settings.uploadLogo')}
                </button>
                <button
                  type="button"
                  onClick={() => { setLogoInputMode('url'); setImageToUpload(null); }}
                  className={`px-3 py-1.5 font-medium transition-colors ${logoInputMode === 'url' ? 'bg-primary text-white' : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                >
                  {t('settings.logoUrlMode')}
                </button>
              </div>

              {/* Upload input */}
              {logoInputMode === 'upload' && (
                <>
                  <label
                    htmlFor="logo-upload"
                    className="cursor-pointer bg-primary text-white px-4 py-2 rounded-xl shadow-md hover:bg-primary/90 transition text-sm font-medium flex items-center gap-1.5"
                  >
                    {t('settings.uploadLogo')}
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
                          setLogoPreviewError(false);
                          setImageToUpload(file);
                          handleChange('root', 'logoImageName', reader.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </>
              )}

              {/* URL input */}
              {logoInputMode === 'url' && (
                <div className="w-full max-w-sm space-y-1">
                  <input
                    type="url"
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-dark-surface text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] transition-all duration-300 ${logoUrlError ? 'border-red-300 dark:border-red-500/50 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200 dark:border-gray-700/80 focus:ring-primary/20 focus:border-primary'}`}
                    placeholder={t('settings.logoUrlPlaceholder')}
                    value={logoUrlValue}
                    onChange={(e) => {
                      const url = e.target.value;
                      setLogoUrlValue(url);
                      setLogoPreviewError(false);
                      if (url && !url.startsWith('http')) {
                        setLogoUrlError(t('settings.logoUrlInvalid'));
                        handleChange('root', 'logoImageName', '');
                      } else {
                        setLogoUrlError(null);
                        handleChange('root', 'logoImageName', url);
                      }
                    }}
                  />
                  {logoUrlError && (
                    <p className="text-red-500 text-xs font-medium">{logoUrlError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Subdomain Section */}
            <div className="mb-8 bg-gray-50/30 dark:bg-gray-800/20 rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/60 transition-all hover:border-gray-300 dark:hover:border-gray-600">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-8">
                <div className="flex-1">
                  <label className="block text-[0.875rem] font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center justify-between">
                    <span>{t('settings.yourLink')}</span>
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
                    {t('settings.linkDescription')}
                  </p>
                </div>

                <div className="w-full md:w-1/2 flex-none relative">
                  {(isCheckingSubdomain || (localWebConfig.subDomain !== webConfig?.subDomain && !subdomainError && (localWebConfig.subDomain?.length ?? 0) >= 2)) && (
                    <div className="hidden md:flex absolute -top-6 end-0 text-secondary text-xs items-center gap-1">
                      {isCheckingSubdomain ? (
                        <>
                          <RefreshCcw className="w-3.5 h-3.5 animate-spin text-primary" />
                          {t('settings.checking')}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 text-green-500" />
                          <span className="text-green-500 font-medium">{t('settings.available')}</span>
                        </>
                      )}
                    </div>
                  )}
                  <div dir="ltr" className={`w-full flex items-stretch rounded-xl border ${subdomainError ? 'border-red-300 dark:border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20' : 'border-gray-200 dark:border-gray-700/80 focus-within:border-primary focus-within:ring-primary/20'} focus-within:ring-[0.1875rem] transition-all duration-300 bg-white dark:bg-dark-surface shadow-sm overflow-hidden`}>
                    <input
                      type="text"
                      className="flex-1 min-w-0 px-4 py-3 bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none text-start text-base sm:text-[0.9375rem] placeholder-gray-400 dark:placeholder-gray-500"
                      value={localWebConfig.subDomain || ''}
                      onChange={(e) => {
                        const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
                        handleChange('root', 'subDomain', value);

                        if (debounceTimeoutRef.current) {
                          clearTimeout(debounceTimeoutRef.current);
                        }

                        if (value.length < 2 || value.length > 20) {
                          setSubdomainError(t('settings.linkRange'));
                          setIsCheckingSubdomain(false);
                        } else if (value !== webConfig?.subDomain && value.length >= 2) {
                          setIsCheckingSubdomain(true);
                          setSubdomainError(null);

                          debounceTimeoutRef.current = setTimeout(async () => {
                            try {
                              const isAvailable = await checkSubdomainAvailability(value);
                              if (!isAvailable) {
                                setSubdomainError(t('settings.subdomainNotAvailable'));
                              }
                            } catch (error) {
                              setSubdomainError(t('settings.subdomainCheckError'));
                            } finally {
                              setIsCheckingSubdomain(false);
                            }
                          }, 500);
                        } else {
                          setIsCheckingSubdomain(false);
                          setSubdomainError(null);
                        }
                      }}
                      placeholder="your-site"
                    />
                    <span className="flex items-center px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 text-[0.9375rem] border-s border-gray-200 dark:border-gray-700/80 whitespace-nowrap">
                      .lightor.app
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const url = `https://${localWebConfig.subDomain || ''}.lightor.app`;
                        navigator.clipboard.writeText(url);
                        toast.success(t('settings.linkCopied'));
                      }}
                      className="flex items-center justify-center px-4 text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-s border-gray-200 dark:border-gray-700/80 transition-colors"
                      title={t('settings.copyLink')}
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
                          <span>{t('settings.subdomainChangedWarning')}</span>
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
                    {t('settings.businessName')}
                    <FieldTooltip
                      title={t('settings.businessName')}
                      description={t('settings.businessNameTooltip')}
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
                    {t('settings.minCancelTime')}
                    <FieldTooltip
                      title={t('settings.minCancelTime')}
                      description={t('settings.minCancelTimeTooltip')}
                    />
                  </>
                }
                leftIcon={<Clock className="w-4 h-4 text-gray-400" />}
                value={localWebConfig.minCancelTimeMS}
                options={cancellationOptions}
                onChange={(e) => handleChange("root", "minCancelTimeMS", Number(e.target.value))}
                error={errors?.minCancelTimeMS}
              />
            </div>

            {/* Intro Popup Message */}
            <div className="mt-6 p-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/30 dark:bg-gray-800/20 space-y-4 hover:border-gray-300 dark:hover:border-gray-600 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    {t('settings.popupMessage')}
                  </h3>
                  <FieldTooltip
                    title={t('settings.popupMessage')}
                    description={t('settings.popupMessageDesc')}
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
                      ? t('settings.active')
                      : t('settings.off')}
                  </span>
                </label>
              </div>

              <textarea
                value={localWebConfig.components?.introPopup?.value ?? ''}
                onChange={(e) => handleChange('components.introPopup', 'value', e.target.value)}
                rows={3}
                placeholder={t('settings.popupPlaceholder')}
                className="w-full bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl px-4 py-3 text-base sm:text-[0.9375rem] border border-yellow-200/60 dark:border-yellow-700/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] focus:ring-yellow-500/20 focus:border-yellow-400 dark:focus:border-yellow-500 transition-all duration-300 resize-none shadow-sm"
              />
            </div>

          </motion.div>
        );

      case 'address':
        return (
          <div className="space-y-6">
            <SectionHeader icon={MapPin} title={t('settings.addressTitle')} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label={t('settings.state')}
                value={localWebConfig.address?.state || ''}
                error={errors?.state}
                onChange={(e) => handleChange('address', 'state', e.target.value)}
              />

              <Input
                label={t('settings.city')}
                error={errors?.city}
                value={localWebConfig.address?.city || ''}
                onChange={(e) => handleChange('address', 'city', e.target.value)}
              />

              <Input
                label={t('settings.street')}
                error={errors?.street}
                value={localWebConfig.address?.street || ''}
                onChange={(e) => handleChange('address', 'street', e.target.value)}
              />

              <Input
                label={t('settings.additionalDetails')}
                value={localWebConfig.address?.other || ''}
                onChange={(e) => handleChange('address', 'other', e.target.value)}
              />
            </div>
          </div>
        );

      case 'contact':
        return (
          <div className="space-y-6">
            <div>
              <SectionHeader icon={Phone} title={t('settings.contactTitle')} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label={t('settings.phone')}
                  value={localWebConfig.contact.phone}
                  minLength={10}
                  maxLength={10}
                  error={errors?.phone}
                  leftIcon={<Phone className="w-4 h-4 text-gray-400" />}
                  onChange={(e) => handleChange('contact', 'phone', e.target.value)}
                />

                <Input
                  label={t('settings.email')}
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
                {t('settings.socialMedia')}
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

      default:
        return (
          <div className="py-8 text-center">
            <p className="text-light-gray">
              {t('settings.selectTab')}
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
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-primary w-6 h-6 shrink-0" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
              {t('settings.title')}
            </h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('settings.description')}
          </p>
        </div>

        {/* Desktop Save Bar */}
        <div className="hidden md:block">
          <AnimatePresence>
            {changesDetected && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-4"
              >
                <UnsavedBar />
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
                <UnsavedBar />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {changesDetected && isStuck && typeof document !== 'undefined' && createPortal(
          <div className="md:hidden fixed top-0 left-0 right-0 z-[40] bg-white/95 dark:bg-dark-bg backdrop-blur-md shadow-md border-b border-orange-200 dark:border-orange-900/50 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <UnsavedBar />
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
