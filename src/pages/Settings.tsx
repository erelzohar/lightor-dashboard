import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, StoreIcon, RefreshCcw, MapPin, Phone, Mail, Image as ImageIcon, Settings as SettingsIcon, Instagram, Facebook, X, Music2, AlertCircle, Copy, Check, Languages, CalendarRange, Globe, CalendarCheck, Inbox } from 'lucide-react';
import UnsavedChangesBar from '../components/ui/UnsavedChangesBar';
import { WebConfig, Address } from '../types';
import { checkSubdomainAvailability } from '../services/webConfigApi';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import WebConfigTabs from '../components/settings/WebConfigTabs';
import toast from 'react-hot-toast';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { fetchAppointmentTypes } from '../store/slices/appointmentsSlice';
import BookingFieldsEditor from '../components/settings/BookingFieldsEditor';
import { bookingFieldsValid, normaliseBookingFields } from '../utils/bookingFields';
import { useAuth } from '../contexts/AuthContext';
import globals from '../services/globals';
import { uploadImage } from '../services/imagesApi';
import FieldTooltip from '../components/settings/FieldTooltip';
import CalendarFeedCard from '../components/settings/CalendarFeedCard';
import GoogleCalendarCard from '../components/settings/GoogleCalendarCard';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
import { useTranslation } from 'react-i18next';
import { isLeadsSite, MAX_CTA_LENGTH } from '../utils/siteMode';

// The public booking site's default language (WebConfig.defaultLanguage) —
// distinct from the owner's dashboard language (User.defaultLanguage). Native
// names so each option reads in the language it selects.
const WEBSITE_LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  he: 'עברית',
  ar: 'العربية',
  fr: 'Français',
  es: 'Español',
};
const WEBSITE_LANGUAGE_OPTIONS = SUPPORTED_LANGUAGES.map((lng) => ({
  value: lng,
  label: WEBSITE_LANGUAGE_NAMES[lng],
}));

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
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const webConfig = useAppSelector(state => state.webConfig.data);
  // The booking-questions editor scopes questions per service (LT-178).
  const appointmentTypes = useAppSelector(state => state.appointments.appointmentTypes);
  // Switching what the site does asks first (LT-199). The target outlives the
  // open flag, so the dialog keeps its words while it animates out.
  const [switchTarget, setSwitchTarget] = useState<'book' | 'lead'>('lead');
  const [switchOpen, setSwitchOpen] = useState(false);

  const resolveLogoUrl = (imgName: string): string => {
    if (!imgName) return '';
    if (imgName.startsWith('http') || imgName.startsWith('data:') || imgName.startsWith('blob:')) return imgName;
    return globals.imagesUrl + imgName;
  };

  // Absent on a config saved before LT-178 and [] after clearing are the same
  // catalog — compare them as such, or an untouched form would report changes.
  const bookingFieldsChanged =
    !!localWebConfig && !!webConfig &&
    JSON.stringify(localWebConfig.bookingFields ?? []) !== JSON.stringify(webConfig.bookingFields ?? []);
  // The contact form's questions (LT-197), by the same rule.
  const leadFieldsChanged =
    !!localWebConfig && !!webConfig &&
    JSON.stringify(localWebConfig.leadFields ?? []) !== JSON.stringify(webConfig.leadFields ?? []);

  // What the site does (LT-199). The SAVED mode decides which booking-only
  // controls this page shows, like every other page; the draft's mode is the
  // one being chosen on the Site tab. Absent and 'book' are the same mode.
  const leadsSite = isLeadsSite(webConfig);
  const draftLeads = isLeadsSite(localWebConfig);
  const conversionChanged = !!localWebConfig && !!webConfig && draftLeads !== leadsSite;
  // The main button's text (LT-199): '' and absent both mean the mode's
  // default, and only trimmed text is stored.
  const ctaOf = (config: WebConfig | null) => (config?.components?.hero?.cta ?? '').trim();
  const ctaChanged = !!localWebConfig && !!webConfig && ctaOf(localWebConfig) !== ctaOf(webConfig);

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
      (localWebConfig.bookingHorizonDays ?? 60) !== (webConfig.bookingHorizonDays ?? 60) ||
      bookingFieldsChanged ||
      leadFieldsChanged ||
      conversionChanged ||
      ctaChanged ||
      JSON.stringify(localWebConfig.businessName) !== JSON.stringify(webConfig.businessName) ||
      JSON.stringify(localWebConfig.defaultLanguage) !== JSON.stringify(webConfig.defaultLanguage) ||
      JSON.stringify(localWebConfig.subDomain) !== JSON.stringify(webConfig.subDomain) ||
      JSON.stringify(localWebConfig.contact) !== JSON.stringify(webConfig.contact) ||
      JSON.stringify(localWebConfig.social) !== JSON.stringify(webConfig.social) ||
      JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig.components?.introPopup) ||
      imageToUpload ||
      (logoInputMode === 'url' && localWebConfig.logoImageName !== originalLogoUrl);

    return settingsChanged;
  };

  const changesDetected = hasChanges();

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

  // One definition of "the form as saved" — used on first load AND by Cancel,
  // so discarding can never leave behind a field the first load would have set.
  const resetFromSaved = (saved: WebConfig) => {
    setLocalWebConfig({
      ...saved,
      // Always one of the two modes (LT-199): a config saved before the
      // switch existed has none, and reads as a booking site.
      conversion: isLeadsSite(saved) ? 'lead' : 'book',
      // The API omits `address` entirely for a business with no premises, but
      // this form needs all four inputs to stay controlled. Give it an empty
      // shape to edit rather than reading `.state` off undefined.
      address: { state: '', city: '', street: '', other: '', ...(saved.address ?? {}) },
      logoImageName: resolveLogoUrl(saved.logoImageName),
    });
    const isUrlLogo = !!saved.logoImageName?.startsWith('http');
    setLogoInputMode(isUrlLogo ? 'url' : 'upload');
    setLogoUrlValue(isUrlLogo ? saved.logoImageName : '');
  };

  useEffect(() => {
    if (!webConfig) fetchWebConfigData();
    else setIsLoading(false);
    if (!localWebConfig && webConfig) resetFromSaved(webConfig);
  }, [webConfig]);

  useEffect(() => {
    if (!appointmentTypes.length && auth.user?.webConfig_id) {
      dispatch(fetchAppointmentTypes({ webConfig_id: auth.user.webConfig_id }));
    }
  }, [appointmentTypes.length, auth.user?.webConfig_id, dispatch]);

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

  // How far ahead customers may book (LT-156), in whole days as the server
  // stores them. Sixty is what every site behaved like before this existed.
  const bookingHorizonOptions = [7, 14, 21, 30, 60, 90, 180].map((days) => ({
    value: days,
    label: `${days} ${t('time.days')}`,
  }));

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

    // The main button's text (LT-199): the server refuses more than this once trimmed.
    cta: (value) =>
      (value ?? '').trim().length > MAX_CTA_LENGTH ? t('settings.site.ctaTooLong', { max: MAX_CTA_LENGTH }) : null,
  };

  // Cancel on the unsaved-changes bar — same behaviour as Schedule & Vacations:
  // the form returns to what is saved, including a picked-but-unsent logo file
  // and any validation message the draft produced.
  const handleDiscard = () => {
    if (!webConfig) return;
    resetFromSaved(webConfig);
    setImageToUpload(null);
    setLogoUrlError(null);
    setLogoPreviewError(false);
    setSubdomainError(null);
    setErrors(null);
    setSwitchOpen(false);
  };

  const handleSave = async () => {
    if (!localWebConfig) return;

    if (
      errors ||
      ctaOf(localWebConfig).length > MAX_CTA_LENGTH ||
      !bookingFieldsValid(localWebConfig.bookingFields ?? []) ||
      !bookingFieldsValid(localWebConfig.leadFields ?? [])
    ) {
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

      const { _id, businessName, subDomain, address, minCancelTimeMS, bookingHorizonDays, social, contact, defaultLanguage } = localWebConfig;

      const fixedSocials = { ...social };
      fixedSocials.facebook = social.facebook === "" ? null : social.facebook;
      fixedSocials.instagram = social.instagram === "" ? null : social.instagram;
      fixedSocials.tiktok = social.tiktok === "" ? null : social.tiktok;
      fixedSocials.x = social.x === "" ? null : social.x;

      const payload: any = { _id, businessName, subDomain, address, minCancelTimeMS, social: fixedSocials, contact, defaultLanguage };
      // Sent only once the owner has a value, so an untouched form never
      // writes the default over nothing (LT-156).
      if (bookingHorizonDays !== undefined) payload.bookingHorizonDays = bookingHorizonDays;
      // The whole catalog, keys included, whenever it was touched (LT-178).
      // Sending it untouched would be harmless, but a config that predates
      // the field is left alone, same as the horizon above.
      if (bookingFieldsChanged) payload.bookingFields = normaliseBookingFields(localWebConfig.bookingFields ?? []);
      if (leadFieldsChanged) {
        payload.leadFields = normaliseBookingFields(localWebConfig.leadFields ?? []).map((f) => ({ ...f, services: [] }));
      }
      // The mode only when the owner switched it (LT-199). The server
      // re-composes the page on this save and deletes nothing.
      if (conversionChanged) payload.conversion = draftLeads ? 'lead' : 'book';
      if (imgResponse) {
        payload.logoImageName = imgResponse.imageName;
      } else if (logoInputMode === 'url' && logoUrlValue && logoUrlValue.startsWith('http')) {
        payload.logoImageName = logoUrlValue;
      }

      // `components` travels only when a section in it changed. The server
      // replaces a section it is sent wholesale (LT-183), so each changed
      // section goes whole: the intro popup as drafted, and the hero as
      // stored with only its button text changed (LT-199) — never `{ cta }`
      // alone, which would wipe the rest of the hero.
      const introPopupChanged =
        JSON.stringify(localWebConfig.components?.introPopup) !== JSON.stringify(webConfig?.components?.introPopup);
      if (introPopupChanged || ctaChanged) {
        payload.components = {
          ...webConfig?.components,
          ...(introPopupChanged ? { introPopup: localWebConfig.components?.introPopup } : {}),
          ...(ctaChanged ? { hero: { ...webConfig?.components?.hero, cta: ctaOf(localWebConfig) } } : {}),
        };
      }

      const res = await dispatch(updateWebConfig(payload));
      if (updateWebConfig.rejected.match(res)) {
        toast.error(t('settings.saveFailed'));
        return;
      }
      // The server assigns a key to every new question. Adopt them into the
      // draft, or the next save would send those questions keyless again and
      // have them re-keyed (LT-178).
      const saved = res.payload as WebConfig | undefined;
      if (Array.isArray(saved?.bookingFields)) {
        setLocalWebConfig(prev => (prev ? { ...prev, bookingFields: saved.bookingFields } : prev));
      }
      if (Array.isArray(saved?.leadFields)) {
        setLocalWebConfig(prev => (prev ? { ...prev, leadFields: saved.leadFields } : prev));
      }
      // The mode and the sections as the server stored them (LT-199): the
      // button text trimmed, and a leads site's contact section forced
      // visible. Adopted, or the form would read as unsaved.
      if (saved) {
        setLocalWebConfig(prev =>
          prev
            ? {
                ...prev,
                conversion: isLeadsSite(saved) ? 'lead' : 'book',
                ...(saved.components ? { components: saved.components } : {}),
              }
            : prev
        );
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
            ...(prev[parentSection as keyof WebConfig] as object),
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
          ...(prev[section as keyof WebConfig] as object),
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

              {/* The cancellation window and the booking horizon govern the
                  calendar, which a leads site does not have (LT-199). Their
                  stored values stay for a switch back. */}
              {!leadsSite && (
                <>
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

                  <Select
                    label={
                      <>
                        {t('settings.bookingHorizon')}
                        <FieldTooltip
                          title={t('settings.bookingHorizon')}
                          description={t('settings.bookingHorizonTooltip')}
                        />
                      </>
                    }
                    leftIcon={<CalendarRange className="w-4 h-4 text-gray-400" />}
                    value={localWebConfig.bookingHorizonDays ?? 60}
                    options={bookingHorizonOptions}
                    onChange={(e) => handleChange("root", "bookingHorizonDays", Number(e.target.value))}
                  />
                </>
              )}

              <Select
                label={
                  <>
                    {t('settings.websiteLanguage')}
                    <FieldTooltip
                      title={t('settings.websiteLanguage')}
                      description={t('settings.websiteLanguageTooltip')}
                    />
                  </>
                }
                leftIcon={<Languages className="w-4 h-4 text-gray-400" />}
                value={localWebConfig.defaultLanguage || 'he'}
                options={WEBSITE_LANGUAGE_OPTIONS}
                onChange={(e) => handleChange('root', 'defaultLanguage', e.target.value)}
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

            {/* Booking questions (LT-178): what the booking form asks beyond
                name and phone. A leads site has no booking form (LT-199). */}
            {!leadsSite && (
              <BookingFieldsEditor
                value={localWebConfig.bookingFields ?? []}
                onChange={(fields) => handleChange('root', 'bookingFields', fields)}
                services={appointmentTypes}
              />
            )}

            {/* Contact-form questions (LT-197): what the lead form asks beyond name and phone. */}
            <BookingFieldsEditor
              value={localWebConfig.leadFields ?? []}
              onChange={(fields) => handleChange('root', 'leadFields', fields)}
              variant="lead"
            />

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

      case 'site': {
        // What the site does and its main button (LT-199).
        const modes = [
          {
            value: 'book' as const,
            Icon: CalendarCheck,
            title: t('settings.site.modeBook'),
            desc: t('settings.site.modeBookDesc'),
          },
          {
            value: 'lead' as const,
            Icon: Inbox,
            title: t('settings.site.modeLead'),
            desc: t('settings.site.modeLeadDesc'),
          },
        ];
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <SectionHeader icon={Globe} title={t('settings.site.title')} />

            <div className="space-y-3">
              <h3 id="site-mode-title" className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                {t('settings.site.modeTitle')}
              </h3>
              <div role="radiogroup" aria-labelledby="site-mode-title" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {modes.map(({ value, Icon, title, desc }) => {
                  const selected = (value === 'lead') === draftLeads;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      // Switching asks first; choosing the current mode is a no-op.
                      onClick={() => {
                        if (selected) return;
                        setSwitchTarget(value);
                        setSwitchOpen(true);
                      }}
                      className={`text-start p-4 rounded-2xl border transition-all ${
                        selected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-white/[0.02] hover:border-primary/40'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 shrink-0 ${selected ? 'text-primary' : 'text-gray-400'}`} />
                        <span className="font-semibold text-gray-900 dark:text-white">{title}</span>
                        {selected && <Check className="w-4 h-4 text-primary ms-auto shrink-0" />}
                      </span>
                      <span className="block mt-1.5 text-sm text-gray-500 dark:text-gray-400">{desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="max-w-md">
              <Input
                id="site-cta"
                label={t('settings.site.ctaLabel')}
                value={localWebConfig.components?.hero?.cta ?? ''}
                maxLength={MAX_CTA_LENGTH}
                // The owner's own words in the site's language, whatever the
                // dashboard's; the placeholder is the default the site shows.
                dir="auto"
                placeholder={t(draftLeads ? 'settings.site.ctaDefaultLead' : 'settings.site.ctaDefaultBook', {
                  lng: localWebConfig.defaultLanguage || undefined,
                })}
                helperText={t('settings.site.ctaHelp')}
                error={errors?.cta}
                onChange={(e) => handleChange('components.hero', 'cta', e.target.value)}
              />
            </div>
          </motion.div>
        );
      }

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
      className={`space-y-6 ${changesDetected ? 'pb-28 sm:pb-8' : ''}`}
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

      </div>

      {/* Floating unsaved-changes bar (shared with Schedule & Vacations). */}
      <UnsavedChangesBar
        visible={!!changesDetected}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={isSaving || isCheckingSubdomain}
        errorMessage={subdomainError}
      />

      <motion.div layout transition={{ duration: 0.3, ease: "easeOut" }}>
        <Card>
          <WebConfigTabs activeTab={activeTab} onTabChange={setActiveTab} />

          <div className="my-6">
            {renderTabContent()}
          </div>
        </Card>
      </motion.div>

      {/* Calendar sync belongs with the business basics — general tab only,
          and a booking site's only: a leads site has no calendar (LT-199). */}
      {activeTab === 'general' && !leadsSite && (
        <motion.div layout transition={{ duration: 0.3, ease: "easeOut" }} className="mt-6 space-y-6">
          <GoogleCalendarCard />
          <CalendarFeedCard />
        </motion.div>
      )}

      {/* Switching modes asks first and says nothing is deleted (LT-199). The
          choice lands in the draft; the save bar commits it. */}
      <ConfirmDialog
        open={switchOpen}
        title={switchTarget === 'lead' ? t('settings.site.switchToLeadTitle') : t('settings.site.switchToBookTitle')}
        message={
          <>
            <p>{switchTarget === 'lead' ? t('settings.site.switchToLeadMessage') : t('settings.site.switchToBookMessage')}</p>
            <p className="mt-2 font-medium text-gray-800 dark:text-gray-100">{t('settings.site.nothingDeleted')}</p>
          </>
        }
        confirmLabel={t('settings.site.switchConfirm')}
        cancelLabel={t('common.cancel')}
        onConfirm={() => {
          handleChange('root', 'conversion', switchTarget);
          setSwitchOpen(false);
        }}
        onClose={() => setSwitchOpen(false)}
      />
    </motion.div>
  );
};

export default Settings;
