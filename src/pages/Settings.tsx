import { CURRENCIES, currencyOf, currencySymbol } from '../utils/currency';
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Info, Type, RefreshCcw, MapPin, Phone, Mail, Image as ImageIcon, Link2, EyeOff, Settings as SettingsIcon, Instagram, Facebook, X, Music2, AlertCircle, Copy, Check, Languages, CalendarRange, Globe, CalendarCheck, Inbox, Accessibility, ExternalLink, Banknote, Tag } from 'lucide-react';
import UnsavedChangesBar from '../components/ui/UnsavedChangesBar';
import { WebConfig, Address } from '../types';
import { checkSubdomainAvailability } from '../services/webConfigApi';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import PhoneInput from '../components/ui/PhoneInput';
import Button from '../components/ui/Button';
import { formatPhoneForDisplay, israeliPhoneKind, samePhone, toE164 } from '../utils/phone';
import { phoneCodeErrorKey, sendPhoneCode, verifyPhoneCode } from '../services/phoneCodeApi';
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
import CategoryFields from '../components/settings/CategoryFields';
import GoogleCalendarCard from '../components/settings/GoogleCalendarCard';
import Select from '../components/ui/Select';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SUPPORTED_LANGUAGES } from '../i18n/config';
import { useTranslation } from 'react-i18next';
import { isLeadsSite, MAX_CTA_LENGTH } from '../utils/siteMode';
import { Toggle } from '../components/ui/liquid-toggle';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/segmented-tabs';
import { ComingSoonRow } from '../components/ui/ComingSoon';
import { pop } from '../components/ui/pop-button';

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

// A cleared social link is typed as "" and saved as null: the same thing, or
// the unsaved-changes bar never cleared after saving it (LT-315).
const socialKey = (social: WebConfig['social'] | undefined): string =>
  JSON.stringify(Object.entries(social ?? {}).map(([key, value]) => [key, value || null]).sort());

// One number however it is written (LT-404): the stored "050-1234567" and
// the field's "+972501234567" are no change.
const contactKey = (contact: WebConfig['contact'] | undefined): string =>
  JSON.stringify({ ...(contact ?? {}), phone: toE164(contact?.phone) ?? contact?.phone ?? '' });

// What the server says about the business phone (LT-404), in the owner's words.
const CONTACT_PHONE_CODES = new Set(['CONTACT_PHONE_INVALID', 'PHONE_NOT_VERIFIED', 'PHONE_MISMATCH']);
const contactPhoneErrorKey = (code: string): string =>
  code === 'PHONE_NOT_VERIFIED' ? 'phoneInput.notVerified' : code === 'PHONE_MISMATCH' ? 'phoneInput.mismatch' : 'phoneInput.invalidAny';

/**
 * One topic of the settings page (LT-316): an icon, a title, a line on what
 * it is for, an optional control on the end side, and its fields. The same
 * box as the booking questions' editor, so every topic reads alike. Defined
 * out here: a component made inside Settings would remount its fields (and
 * drop the caret) on every keystroke.
 */
const SettingsSection: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  titleId?: string;
  description?: string;
  descriptionId?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ icon: Icon, title, titleId, description, descriptionId, action, children }) => (
  <section className="p-5 sm:p-6 rounded-2xl border border-gray-200/60 dark:border-gray-700/60 bg-gray-50/30 dark:bg-gray-800/20 space-y-5">
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h3 id={titleId} className="font-semibold text-gray-900 dark:text-white">{title}</h3>
          {description && <p id={descriptionId} className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
      </div>
      {action}
    </div>
    {children}
  </section>
);

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
  // The business phone (LT-404). A mobile that is neither the owner's nor
  // the one stored is proven by a code sent to it, as the account's phone
  // is: the save waits here, the code field shows under the number, and
  // the save goes out again with the proof (`contactPhoneToken`).
  const [triedSave, setTriedSave] = useState(false);
  const [phoneCodeFor, setPhoneCodeFor] = useState<string | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneCodeError, setPhoneCodeError] = useState<string | null>(null);
  const [phoneCodeBusy, setPhoneCodeBusy] = useState(false);
  const [contactPhoneError, setContactPhoneError] = useState<string | null>(null);
  const clearPhoneCode = () => {
    setPhoneCodeFor(null);
    setPhoneCode('');
    setPhoneCodeError(null);
  };

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
  useEffect(() => {
    if (leadsSite && activeTab === 'bookings') setActiveTab('general');
  }, [leadsSite, activeTab]);
  const draftLeads = isLeadsSite(localWebConfig);
  const conversionChanged = !!localWebConfig && !!webConfig && draftLeads !== leadsSite;
  // The main button's text (LT-199): '' and absent both mean the mode's
  // default, and only trimmed text is stored.
  const ctaOf = (config: WebConfig | null) => (config?.components?.hero?.cta ?? '').trim();
  const ctaChanged = !!localWebConfig && !!webConfig && ctaOf(localWebConfig) !== ctaOf(webConfig);
  // The currency (LT-395): absent reads as shekels.
  const currencyChanged =
    !!localWebConfig && !!webConfig && currencyOf(localWebConfig.currency) !== currencyOf(webConfig.currency);
  // The category and keywords (LT-453): absent, null and empty are the same.
  const categoryKey = (config: WebConfig | null) => (config?.category?.main ? `${config.category.main}/${config.category.sub ?? ''}` : '');
  const categoryChanged = !!localWebConfig && !!webConfig && categoryKey(localWebConfig) !== categoryKey(webConfig);
  const keywordsChanged =
    !!localWebConfig && !!webConfig && JSON.stringify(localWebConfig.keywords ?? []) !== JSON.stringify(webConfig.keywords ?? []);
  // Hidden from search engines (LT-208): absent and false are the same.
  const hideFromSearchChanged =
    !!localWebConfig && !!webConfig && !!localWebConfig.hideFromSearch !== !!webConfig.hideFromSearch;
  // The accessibility menu (LT-346): absent reads as shown.
  const a11yMenuHidden = (config: WebConfig | null) => !!config?.accessibility?.widgetHidden;
  const a11yMenuChanged = !!localWebConfig && !!webConfig && a11yMenuHidden(localWebConfig) !== a11yMenuHidden(webConfig);

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
      hideFromSearchChanged ||
      a11yMenuChanged ||
      currencyChanged ||
      categoryChanged ||
      keywordsChanged ||
      JSON.stringify(localWebConfig.businessName) !== JSON.stringify(webConfig.businessName) ||
      JSON.stringify(localWebConfig.defaultLanguage) !== JSON.stringify(webConfig.defaultLanguage) ||
      JSON.stringify(localWebConfig.subDomain) !== JSON.stringify(webConfig.subDomain) ||
      contactKey(localWebConfig.contact) !== contactKey(webConfig.contact) ||
      socialKey(localWebConfig.social) !== socialKey(webConfig.social) ||
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

    // Any valid Israeli number, mobile or landline (LT-404). The field shows
    // its own message; this entry keeps the save shut meanwhile.
    phone: (value) => (israeliPhoneKind(value) ? null : t('phoneInput.invalidAny')),

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
    setTriedSave(false);
    setContactPhoneError(null);
    clearPhoneCode();
  };

  const handleSave = async (contactPhoneToken?: string) => {
    if (!localWebConfig) return;
    setTriedSave(true);

    if (
      errors ||
      // An invalid or taken link would only come back refused (LT-315).
      subdomainError ||
      ctaOf(localWebConfig).length > MAX_CTA_LENGTH ||
      !bookingFieldsValid(localWebConfig.bookingFields ?? []) ||
      !bookingFieldsValid(localWebConfig.leadFields ?? [])
    ) {
      toast.error(t('settings.formErrors'));
      if (errors?.phone) setActiveTab('contact');
      return;
    }

    // A new mobile that is not the owner's own first gets a code (LT-404).
    // A landline cannot take one and needs none; the stored number and the
    // owner's (proven when it was set) need none either.
    const typedPhone = localWebConfig.contact?.phone;
    const needsCode =
      !contactPhoneToken &&
      israeliPhoneKind(typedPhone) === 'mobile' &&
      !samePhone(typedPhone, webConfig?.contact?.phone) &&
      !samePhone(typedPhone, auth.user?.phone);
    if (needsCode) {
      const e164 = toE164(typedPhone) as string;
      setActiveTab('contact');
      // Already sent to this number: the code field is waiting for it.
      if (phoneCodeFor === e164) return;
      setPhoneCodeError(null);
      setPhoneCodeBusy(true);
      try {
        await sendPhoneCode(e164, 'sms', auth.user?.defaultLanguage || 'he');
        setPhoneCodeFor(e164);
      } catch (error) {
        setPhoneCodeError(t(phoneCodeErrorKey(error)));
      } finally {
        setPhoneCodeBusy(false);
      }
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

      // No time zone here (LT-334): it is set once, when the site is made
      // (the signing-up device's zone, else the server's default), and the
      // owner never has to think about it — the page leaves it as stored.
      // The phone in E.164, the form the server stores (LT-404).
      const fixedContact = contact ? { ...contact, phone: toE164(contact.phone) ?? contact.phone } : contact;
      const payload: any = { _id, businessName, subDomain, address, minCancelTimeMS, social: fixedSocials, contact: fixedContact, defaultLanguage };
      if (contactPhoneToken) payload.contactPhoneToken = contactPhoneToken;
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
      // Only when the owner flipped it (LT-208), as the mode above.
      if (hideFromSearchChanged) payload.hideFromSearch = !!localWebConfig.hideFromSearch;
      if (a11yMenuChanged) payload.accessibility = { widgetHidden: a11yMenuHidden(localWebConfig) };
      // The currency only when the owner chose one (LT-395).
      if (currencyChanged) payload.currency = currencyOf(localWebConfig.currency);
      // The category and keywords only when changed (LT-453); the server checks the keys.
      if (categoryChanged) payload.category = localWebConfig.category?.main ? localWebConfig.category : null;
      if (keywordsChanged) payload.keywords = localWebConfig.keywords ?? [];
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
        const code = res.error?.code;
        if (code && CONTACT_PHONE_CODES.has(code)) {
          const message = t(contactPhoneErrorKey(code));
          setContactPhoneError(message);
          clearPhoneCode();
          setActiveTab('contact');
          toast.error(message);
          return;
        }
        toast.error(t('settings.saveFailed'));
        return;
      }
      setContactPhoneError(null);
      clearPhoneCode();
      setTriedSave(false);
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
      // visible. Adopted, or the form would read as unsaved. So is the
      // search-engine switch (LT-208), which shows what the server stored.
      if (saved) {
        setLocalWebConfig(prev =>
          prev
            ? {
                ...prev,
                conversion: isLeadsSite(saved) ? 'lead' : 'book',
                hideFromSearch: !!saved.hideFromSearch,
                accessibility: { widgetHidden: a11yMenuHidden(saved) },
                ...(saved.components ? { components: saved.components } : {}),
              }
            : prev
        );
      }
      setImageToUpload(null);
      // A logo given as a link stays in its box (LT-340): emptying it after
      // every save made the logo look gone while it was still on the site.
      setLogoUrlValue(saved?.logoImageName?.startsWith('http') ? saved.logoImageName : '');
      toast.success(t('settings.saveSuccess'));
    } catch (error) {
      console.log(error);
      toast.error(t('settings.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // The code for the business mobile: checked, then the save goes out with its proof.
  const confirmPhoneCode = async (value: string) => {
    if (!phoneCodeFor || value.length !== 6 || phoneCodeBusy) return;
    setPhoneCodeBusy(true);
    setPhoneCodeError(null);
    let token: string;
    try {
      token = await verifyPhoneCode(phoneCodeFor, value);
    } catch (error) {
      setPhoneCode('');
      setPhoneCodeError(t(phoneCodeErrorKey(error)));
      setPhoneCodeBusy(false);
      return;
    }
    setPhoneCodeBusy(false);
    await handleSave(token);
  };

  // One copy action for the link row's button and its phone twin (LT-435).
  const copySiteLink = () => {
    navigator.clipboard.writeText(`https://${localWebConfig?.subDomain || ''}.lightor.app`);
    toast.success(t('settings.linkCopied'));
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

  const renderTabContent = () => {
    switch (activeTab) {
      // Who the business is: its name, its logo, where it is (LT-316).
      case 'general':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            {/* The site's link comes first (LT-434, Erel): the thing an owner
                shares most. Its title labels the field; the chip says whether
                a new link is free. */}
            <SettingsSection
              icon={Link2}
              title={t('settings.yourLink')}
              titleId="settings-link-title"
              description={t('settings.linkDescription')}
              descriptionId="settings-link-desc"
              action={
                (isCheckingSubdomain || (localWebConfig.subDomain !== webConfig?.subDomain && !subdomainError && (localWebConfig.subDomain?.length ?? 0) >= 2)) && (
                  <span className="text-xs flex items-center gap-1" role="status">
                    {isCheckingSubdomain ? (
                      <>
                        <RefreshCcw className="w-3.5 h-3.5 animate-spin text-primary" />
                        <span className="text-gray-500 dark:text-gray-400">{t('settings.checking')}</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 text-green-500" />
                        <span className="text-green-600 dark:text-green-400 font-medium">{t('settings.available')}</span>
                      </>
                    )}
                  </span>
                )
              }
            >
              {/* As wide as the name field on a computer, not the whole card
                  (LT-435, Erel: "full width doesn't look good"). */}
              <div className="w-full max-w-md">
                <div dir="ltr" className={`w-full flex items-stretch rounded-xl border ${subdomainError ? 'border-red-300 dark:border-red-500/50 focus-within:border-red-500 focus-within:ring-red-500/20' : 'border-gray-200 dark:border-gray-700/80 focus-within:border-primary focus-within:ring-primary/20'} focus-within:ring-[0.1875rem] transition-all duration-300 bg-white dark:bg-dark-surface shadow-sm overflow-hidden`}>
                  <input
                    id="settings-subdomain"
                    type="text"
                    aria-labelledby="settings-link-title"
                    aria-describedby="settings-link-desc"
                    className="flex-1 min-w-0 px-3 sm:px-4 py-3 bg-transparent text-gray-800 dark:text-gray-100 focus:outline-none text-start text-base sm:text-[0.9375rem] placeholder-gray-400 dark:placeholder-gray-500"
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
                      } else if (value.startsWith('-') || value.endsWith('-')) {
                        // A DNS label, as the API now insists (LT-315):
                        // say what is wrong, not "not available".
                        setSubdomainError(t('settings.subdomainInvalid'));
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
                  <span className="flex items-center px-2 sm:px-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 text-sm sm:text-[0.9375rem] border-s border-gray-200 dark:border-gray-700/80 whitespace-nowrap">
                    .lightor.app
                  </span>
                  <button
                    type="button"
                    onClick={copySiteLink}
                    className="hidden sm:flex items-center justify-center px-4 text-primary hover:bg-primary/5 dark:hover:bg-primary/10 border-s border-gray-200 dark:border-gray-700/80 transition-colors"
                    title={t('settings.copyLink')}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {/* Phones (LT-435): the copy button leaves the row, and the
                    box gets the room to show the whole link. */}
                <button
                  type="button"
                  onClick={copySiteLink}
                  className="sm:hidden mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary"
                >
                  <Copy className="w-4 h-4" />
                  {t('settings.copyLink')}
                </button>
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
            </SettingsSection>

            {/* The name of a business, a brand, an event or a project (LT-370): "general", not "the business". */}
            <SettingsSection icon={Info} title={t('settings.sections.business')} description={t('settings.sections.businessDesc')}>
              <div className="max-w-md">
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
                  leftIcon={<Type className="w-4 h-4 text-gray-400" />}
                  helperText={t('settings.businessNameHint')}
                  value={localWebConfig.businessName}
                  error={errors?.businessName}
                  onChange={(e) => handleChange('root', 'businessName', e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="shrink-0">
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
                </div>
                <div className="flex flex-col items-center sm:items-start gap-3 min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('settings.logo')}</p>
                  {/* Mode toggle */}
                  <Tabs
                    value={logoInputMode}
                    onValueChange={(mode) => {
                      if (mode === 'upload') { setLogoInputMode('upload'); setLogoUrlError(null); }
                      else { setLogoInputMode('url'); setImageToUpload(null); }
                    }}
                  >
                    <TabsList className="w-fit">
                      <TabsTrigger value="upload"><ImageIcon />{t('settings.uploadLogo')}</TabsTrigger>
                      <TabsTrigger value="url"><Link2 />{t('settings.logoUrlMode')}</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  {/* Upload input */}
                  {logoInputMode === 'upload' && (
                    <>
                      <label
                        htmlFor="logo-upload"
                        className={`cursor-pointer ${pop()} px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5`}
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
              </div>
            </SettingsSection>

            {/* LT-453: what the site is, for a directory of sites to come. */}
            <SettingsSection icon={Tag} title={t('settings.category.title')} description={t('settings.category.desc')}>
              <CategoryFields
                category={localWebConfig.category}
                keywords={localWebConfig.keywords}
                onCategoryChange={(category) => handleChange('root', 'category', category)}
                onKeywordsChange={(keywords) => handleChange('root', 'keywords', keywords)}
              />
            </SettingsSection>

            <SettingsSection icon={MapPin} title={t('settings.addressTitle')} description={t('settings.sections.addressDesc')}>
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
            </SettingsSection>
          </motion.div>
        );

      // How customers reach the business — shown on the site.
      case 'contact':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SettingsSection icon={Phone} title={t('settings.contactTitle')} description={t('settings.sections.contactDesc')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Mobile or landline, Israeli (LT-404). */}
                <PhoneInput
                  label={t('settings.phone')}
                  name="contactPhone"
                  accept="any"
                  value={localWebConfig.contact.phone ?? ''}
                  required
                  showError={triedSave}
                  error={contactPhoneError}
                  onChange={(phone) => {
                    handleChange('contact', 'phone', phone);
                    setContactPhoneError(null);
                    clearPhoneCode();
                  }}
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

              {/* The code sent to a new business mobile (LT-404). */}
              {phoneCodeFor && (
                <div className="space-y-3 max-w-md" data-testid="contact-phone-code">
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {t('phoneInput.businessCodeHint')} {t('account.phoneCode.sent', { phone: formatPhoneForDisplay(phoneCodeFor) })}
                  </p>
                  <Input
                    id="contact-phone-code"
                    label={t('account.phoneCode.label')}
                    name="contactPhoneCode"
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={phoneCode}
                    disabled={phoneCodeBusy}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                      setPhoneCode(digits);
                      setPhoneCodeError(null);
                      if (digits.length === 6) void confirmPhoneCode(digits);
                    }}
                  />
                  <Button type="button" isLoading={phoneCodeBusy} disabled={phoneCode.length !== 6} onClick={() => void confirmPhoneCode(phoneCode)}>
                    {t('account.phoneCode.confirm')}
                  </Button>
                </div>
              )}
              {phoneCodeError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{phoneCodeError}</p>}
            </SettingsSection>

            <SettingsSection icon={Instagram} title={t('settings.socialMedia')} description={t('settings.sections.socialDesc')}>
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
            </SettingsSection>
          </motion.div>
        );

      // Everything about the site itself: its address and language, what it
      // does, its popup, its contact form, and search engines.
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SettingsSection icon={Languages} title={t('settings.sections.siteBasics')} description={t('settings.sections.siteBasicsDesc')}>
              {/* One column (LT-334): each item its label and line above a
                  full-width control, a hairline between them. */}
              <div className="divide-y divide-gray-200/70 dark:divide-gray-700/50 [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
              <div>
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
              {/* Coming soon (LT-331): the site at the owner's own address — a
                  quiet row in the list, not a box of its own (LT-334). */}
              <ComingSoonRow
                icon={Globe}
                title={t('settings.customDomain.title')}
                description={t('settings.customDomain.desc')}
                className="p-0 rounded-none border-0 border-solid bg-transparent dark:bg-transparent"
              />
              </div>
            </SettingsSection>

            <SettingsSection icon={Globe} title={t('settings.site.modeTitle')} titleId="site-mode-title">
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
            </SettingsSection>

            {/* The site's currency (LT-395): picked by the AI from the
                business's country when the site was built; the owner fixes it
                here if it guessed wrong. Prices on the site and income here. */}
            <SettingsSection
              icon={Banknote}
              title={t('settings.site.currencyTitle')}
              titleId="site-currency-title"
              description={t('settings.site.currencyHelp')}
            >
              <div role="radiogroup" aria-labelledby="site-currency-title" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CURRENCIES.map((code) => {
                  const selected = currencyOf(localWebConfig.currency) === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      data-testid={`currency-${code}`}
                      onClick={() => handleChange('root', 'currency', code)}
                      className={`flex items-center gap-2 p-3 rounded-2xl border text-start transition-colors ${
                        selected
                          ? 'border-primary bg-primary/5 dark:bg-primary/10 ring-2 ring-primary/20'
                          : 'border-gray-200 dark:border-gray-700 bg-white/40 dark:bg-white/[0.02] hover:border-primary/40'
                      }`}
                    >
                      <span className={`text-lg font-bold w-6 text-center ${selected ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden="true">
                        {currencySymbol(code)}
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">{t(`settings.site.currency.${code}`)}</span>
                      {selected && <Check className="w-4 h-4 text-primary ms-auto shrink-0" aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </SettingsSection>

            <SettingsSection
              icon={AlertCircle}
              title={t('settings.popupMessage')}
              description={t('settings.popupMessageDesc')}
              action={
                <label className="relative inline-flex items-center cursor-pointer">
                  <Toggle
                    checked={localWebConfig.components?.introPopup?.visible ?? false}
                    onCheckedChange={(on) => handleChange('components.introPopup', 'visible', on)}
                  />
                  <span className="ms-2 text-sm text-light-text">
                    {localWebConfig.components?.introPopup?.visible
                      ? t('settings.active')
                      : t('settings.off')}
                  </span>
                </label>
              }
            >
              <textarea
                value={localWebConfig.components?.introPopup?.value ?? ''}
                onChange={(e) => handleChange('components.introPopup', 'value', e.target.value)}
                rows={3}
                placeholder={t('settings.popupPlaceholder')}
                className="w-full bg-yellow-50/50 dark:bg-yellow-900/10 rounded-xl px-4 py-3 text-base sm:text-[0.9375rem] border border-yellow-200/60 dark:border-yellow-700/30 text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-[0.1875rem] focus:ring-yellow-500/20 focus:border-yellow-400 dark:focus:border-yellow-500 transition-all duration-300 resize-none shadow-sm"
              />
            </SettingsSection>

            {/* Contact-form questions (LT-197): what the lead form asks beyond name and phone. */}
            <BookingFieldsEditor
              value={localWebConfig.leadFields ?? []}
              onChange={(fields) => handleChange('root', 'leadFields', fields)}
              variant="lead"
            />

            {/* Out of search engines (LT-208): the edge serves the site with
                noindex and leaves it out of the sitemaps and lightor.app/sites.
                A draft like the rest; the save bar commits it. */}
            <SettingsSection
              icon={EyeOff}
              title={t('settings.site.hideFromSearch')}
              titleId="site-hide-from-search-label"
              description={t('settings.site.hideFromSearchHelp')}
              descriptionId="site-hide-from-search-help"
              action={
                <Toggle
                  id="site-hide-from-search"
                  checked={!!localWebConfig.hideFromSearch}
                  aria-labelledby="site-hide-from-search-label"
                  aria-describedby="site-hide-from-search-help"
                  onCheckedChange={(on) => handleChange('root', 'hideFromSearch', on)}
                />
              }
            />

            {/* The accessibility menu on the site (LT-346): on unless hidden.
                The statement is on every site whatever this says. */}
            <SettingsSection
              icon={Accessibility}
              title={t('settings.site.a11yMenu')}
              titleId="site-a11y-menu-label"
              description={t('settings.site.a11yMenuHelp')}
              descriptionId="site-a11y-menu-help"
              action={
                <Toggle
                  id="site-a11y-menu"
                  checked={!a11yMenuHidden(localWebConfig)}
                  aria-labelledby="site-a11y-menu-label"
                  aria-describedby="site-a11y-menu-help"
                  onCheckedChange={(on) => handleChange('root', 'accessibility', { widgetHidden: !on })}
                />
              }
            >
              {localWebConfig.subDomain && (
                <a
                  href={`https://${localWebConfig.subDomain}.lightor.app/#accessibility`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {t('settings.site.a11yStatementLink')}
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
              )}
            </SettingsSection>
          </motion.div>
        );
      }

      // The booking rules and questions — a booking site's only (LT-199: a
      // leads site has no calendar; the stored values stay for a switch back).
      case 'bookings':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <SettingsSection icon={Clock} title={t('settings.sections.bookingRules')} description={t('settings.sections.bookingRulesDesc')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
            </SettingsSection>

            {/* Booking questions (LT-178): what the booking form asks beyond
                name and phone. */}
            <BookingFieldsEditor
              value={localWebConfig.bookingFields ?? []}
              onChange={(fields) => handleChange('root', 'bookingFields', fields)}
              services={appointmentTypes}
            />
          </motion.div>
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
      // One centred column, as wide as the account page's (LT-316).
      className={`w-full max-w-3xl mx-auto space-y-6 ${changesDetected ? 'pb-28 sm:pb-8' : ''}`}
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
        onSave={() => void handleSave()}
        onDiscard={handleDiscard}
        saving={isSaving || isCheckingSubdomain || phoneCodeBusy}
        errorMessage={subdomainError}
      />

      <motion.div layout transition={{ duration: 0.3, ease: "easeOut" }}>
        <Card>
          <WebConfigTabs activeTab={activeTab} onTabChange={setActiveTab} bookings={!leadsSite} />

          <div className="my-6">
            {renderTabContent()}
          </div>
        </Card>
      </motion.div>

      {/* Calendar sync sits with the bookings (LT-316) — a booking site's
          only: a leads site has no calendar (LT-199). */}
      {activeTab === 'bookings' && !leadsSite && (
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
