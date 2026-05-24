import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Paperclip, X, Monitor,
  Smartphone, Loader2, RotateCcw, CheckCircle2, Save, Eye, EyeOff, Maximize2, Minimize2,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { updateWebConfig, createWebConfig, fetchWebConfig } from '../store/slices/webConfigSlice';
import { aiService, type AiSiteConfig } from '../services/aiApi';
import { createAppointmentType, updateAppointmentType } from '../services/appointmentsApi';
import { createVacation } from '../services/vacationsApi';
import type { WebConfig, AppointmentType, Vacation } from '../types';
import toast from 'react-hot-toast';

const isValidObjectId = (id: string) => /^[a-f\d]{24}$/i.test(id);

const CLIENT_APP_URL =
  (import.meta.env.VITE_CLIENT_APP_URL as string | undefined) || 'http://localhost:5174';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const TypingIndicator: React.FC<{ isRtl?: boolean }> = ({ isRtl }) => (
  <div className={`flex gap-3 max-w-[90%] ${isRtl ? 'flex-row-reverse self-end' : ''}`}>
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/30 flex items-center justify-center shrink-0 shadow-sm border border-violet-200/50 dark:border-violet-700/30">
      <Sparkles className="w-4 h-4 text-primary animate-pulse" />
    </div>
    <div className="flex flex-col gap-1.5">
      <span className={`text-xs font-medium text-gray-400 dark:text-slate-500 ${isRtl ? 'me-1.5' : 'ms-1.5'}`}>Lighty AI</span>
      <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm px-5 py-3.5 shadow-sm border border-gray-100 dark:border-slate-600/50 rounded-3xl rounded-tl-sm">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="w-2 h-2 bg-slate-400 dark:bg-slate-300 rounded-full dot-wave"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  </div>
);

const AiBuilder: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { auth, updateUser } = useAuth();
  const { direction } = useTheme();
  const isRtl = direction === 'rtl';
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector((state) => state.webConfig.data);

  const isEditMode = !!(auth.user?.webConfig_id || webConfig?.businessName);

  const [messages, setMessages] = useState<Message[]>(() => {
    if (webConfig?.businessName) {
      return [{ role: 'assistant', content: t('aiBuilder.editWelcome', { name: webConfig.businessName }) }];
    }
    return [{ role: 'assistant', content: t('aiBuilder.lightyWelcome') }];
  });

  const [input, setInput] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [draftConfig, setDraftConfig] = useState<AiSiteConfig | null>(
    webConfig?.businessName ? (webConfig as unknown as AiSiteConfig) : null
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [generatedThisSession, setGeneratedThisSession] = useState(false);
  const [isMobilePreview, setIsMobilePreview] = useState(false);
  const [showPreview, setShowPreview] = useState(() => window.innerWidth >= 768);
  const [isPreviewFullscreen, setIsPreviewFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'preview'>('chat');
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 768);
  // Track whether the iframe has fully loaded and React inside it has had
  // time to mount + register its message listener (same pattern as Hero.tsx).
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update welcome message when webConfig loads with the business name
  useEffect(() => {
    if (webConfig?.businessName) {
      setMessages((prev) => {
        if (prev.length === 1 && prev[0].role === 'assistant') {
          return [{ role: 'assistant', content: t('aiBuilder.editWelcome', { name: webConfig.businessName }) }];
        }
        return prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webConfig?.businessName]);

  useEffect(() => {
    const floatingMessage = (location.state as { floatingMessage?: string } | null)?.floatingMessage;
    if (floatingMessage) {
      window.history.replaceState({}, '');
      handleSubmit(undefined, floatingMessage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handler = () => setIsLargeScreen(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    if (auth.user?.webConfig_id && !webConfig) {
      dispatch(fetchWebConfig(auth.user.webConfig_id));
    }
  }, [auth.user?.webConfig_id, webConfig, dispatch]);

  useEffect(() => {
    if (webConfig?.businessName && !draftConfig) {
      setDraftConfig(webConfig as unknown as AiSiteConfig);
    }
  }, [webConfig, draftConfig]);

  const sendConfigToIframe = (config: AiSiteConfig) => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'PREVIEW_DATA', config }, '*');
  };

  // Mirror the Hero.tsx pattern: wait 500 ms after the iframe onLoad fires so
  // that the React app inside the iframe has time to mount and register its
  // window.addEventListener('message', …) before we send PREVIEW_DATA.
  // Without this delay the message arrives before the listener is registered
  // and is silently dropped — leaving the iframe stuck on the loading spinner.
  const handleIframeLoad = () => {
    setIframeLoaded(false);
    setTimeout(() => setIframeLoaded(true), 500);
  };

  // Send config whenever draftConfig OR iframeLoaded change, but only once
  // both are truthy (iframe is ready AND we have something to show).
  useEffect(() => {
    if (!draftConfig || !iframeLoaded) return;
    sendConfigToIframe(draftConfig);
  }, [draftConfig, iframeLoaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const autoResizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handleSubmit = async (e?: React.FormEvent, externalMessage?: string) => {
    e?.preventDefault();
    const prompt = externalMessage ?? input.trim();
    if (!prompt || isGenerating) return;

    if (!externalMessage) {
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }

    setMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setIsGenerating(true);

    try {
      let newConfig: AiSiteConfig;
      if (draftConfig?.businessName) {
        newConfig = await aiService.editSite(prompt, draftConfig, logoFile);
      } else {
        newConfig = await aiService.generateSite(prompt, logoFile);
      }

      setDraftConfig(newConfig);
      setGeneratedThisSession(true);
      setLogoFile(null);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('aiBuilder.generatedMessage', { name: newConfig.businessName }) },
      ]);
      if (activeTab === 'chat') setActiveTab('preview');
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: t('aiBuilder.errorMessage') },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draftConfig) return;
    setIsSaving(true);
    try {
      const { appointmentTypes, vacations, ...configToSave } = draftConfig as AiSiteConfig & {
        appointmentTypes?: Omit<AppointmentType, '_id'>[];
        vacations?: Omit<Vacation, '_id' | 'webConfig_id'>[];
      };

      const configId = webConfig?._id || auth.user?.webConfig_id;
      let savedConfigId: string;

      if (configId) {
        await dispatch(updateWebConfig({ ...(configToSave as unknown as Partial<WebConfig>), _id: configId }));
        savedConfigId = configId;
        if (auth.user?.boardingStatus === 'new') await updateUser({ boardingStatus: 'onboarded' });
      } else {
        const result = await dispatch(createWebConfig({
          ...(configToSave as unknown as Partial<WebConfig>),
          user_id: auth.user?._id,
        }));
        const newConf = result.payload as WebConfig;
        savedConfigId = newConf._id;
        await updateUser({ webConfig_id: newConf._id, boardingStatus: 'onboarded' });
      }

      if (appointmentTypes?.length) {
        await Promise.all(
          appointmentTypes.map((type) => {
            const { _id, ...rest } = type as AppointmentType;
            if (_id && isValidObjectId(_id)) return updateAppointmentType(_id, { ...rest, webConfig_id: savedConfigId });
            return createAppointmentType({ ...rest, webConfig_id: savedConfigId });
          })
        );
      }

      if (vacations?.length) {
        await Promise.all(vacations.map((v) => createVacation({ ...v, webConfig_id: savedConfigId })));
      }

      setSaved(true);
      setTimeout(() => navigate('/dashboard'), 1200);
    } catch (err) {
      toast.error('Failed to save website. Please try again.');
      console.error('Save failed:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const previewUrl = webConfig?.subDomain && import.meta.env.PROD
    ? `https://${webConfig.subDomain}.lightor.app`
    : CLIENT_APP_URL;

  const showPhoneShell = isMobilePreview && isLargeScreen;
  const hasUserMessage = messages.some((m) => m.role === 'user');

  const suggestions = isEditMode
    ? [
        t('aiBuilder.suggestion_edit_1'),
        t('aiBuilder.suggestion_edit_2'),
        t('aiBuilder.suggestion_edit_3'),
      ]
    : [
        t('aiBuilder.suggestion_new_1'),
        t('aiBuilder.suggestion_new_2'),
      ];

  const saveDisabled = !generatedThisSession || isSaving || saved;

  return (
    <div className="flex flex-col h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] -m-4 md:-m-6 overflow-hidden bg-gradient-to-br from-violet-50 via-slate-50 to-indigo-50/70 dark:from-slate-950 dark:via-violet-950/10 dark:to-slate-950">

      {/* ── Header ── */}
      <header className="h-16 flex items-center justify-between px-6 shrink-0 z-20">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-violet-400 flex items-center justify-center shadow-md">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-gray-800 dark:text-white text-[15px] tracking-tight">
            {t('aiBuilder.title')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Mobile tab toggle */}
          <div className="flex md:hidden items-center gap-1 bg-white/70 dark:bg-slate-800/70 rounded-full p-1 border border-gray-200/60 dark:border-slate-700/50 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'chat'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              {t('aiBuilder.chatTab')}
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              {t('aiBuilder.previewTab')}
            </button>
          </div>

          {/* Desktop preview toggle */}
          <button
            onClick={() => setShowPreview((v) => !v)}
            className={`hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
              showPreview
                ? 'bg-primary/10 border-primary/30 text-primary dark:bg-primary/20 dark:border-primary/40 dark:text-violet-300'
                : 'bg-white/70 dark:bg-slate-800/70 border-gray-200/60 dark:border-slate-700/50 text-gray-500 dark:text-slate-400 hover:border-primary/30 hover:text-primary dark:hover:text-violet-300'
            }`}
          >
            {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showPreview ? t('aiBuilder.hidePreview') : t('aiBuilder.togglePreview')}
          </button>

          {/* Save button */}
          {(draftConfig || isEditMode) && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={handleSave}
              disabled={saveDisabled}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-md hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-md ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gradient-to-r from-primary to-violet-500 text-white'
              }`}
            >
              {saved ? (
                <><CheckCircle2 className="w-4 h-4" />{t('aiBuilder.saved')}</>
              ) : isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" />{t('aiBuilder.saving')}</>
              ) : (
                <><Save className="w-4 h-4" />{t('aiBuilder.save')}</>
              )}
            </motion.button>
          )}
        </div>
      </header>

      {/* ── Workspace ── */}
      <main className="flex-1 flex overflow-hidden px-5 pb-5 gap-4">

        {/* ── Live Preview (desktop toggle / mobile tab) ── */}
        <section
          className={`bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/60 dark:border-slate-700/50 rounded-2xl flex-col overflow-hidden shadow-sm ${
            isPreviewFullscreen
              ? 'fixed inset-0 z-50 flex rounded-none border-0'
              : `flex-1 ${activeTab === 'preview' ? 'flex' : 'hidden'} ${showPreview ? 'md:flex' : 'md:hidden'}`
          }`}
        >
          {/* Toolbar */}
          <div className="flex items-center justify-between mx-4 mt-4 mb-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md py-2 px-4 rounded-full shadow-sm border border-gray-200/50 dark:border-slate-700/50 shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => { if (iframeRef.current) iframeRef.current.src = previewUrl; }}
                className="p-2 text-gray-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full transition-colors"
                title={t('aiBuilder.refresh')}
              >
                <RotateCcw size={16} />
              </button>
              <div className="hidden md:block w-px h-5 bg-gray-200 dark:bg-slate-600 mx-1" />
              <button
                onClick={() => setIsMobilePreview(false)}
                className={`hidden md:flex p-2 rounded-full transition-colors ${
                  !isMobilePreview
                    ? 'text-primary bg-violet-50 dark:bg-violet-900/20'
                    : 'text-gray-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20'
                }`}
                title="Desktop"
              >
                <Monitor size={16} />
              </button>
              <button
                onClick={() => setIsMobilePreview(true)}
                className={`hidden md:flex p-2 rounded-full transition-colors ${
                  isMobilePreview
                    ? 'text-primary bg-violet-50 dark:bg-violet-900/20'
                    : 'text-gray-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20'
                }`}
                title="Mobile"
              >
                <Smartphone size={16} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest">
                {t('aiBuilder.preview')}
              </span>
              <button
                onClick={() => setIsPreviewFullscreen((v) => !v)}
                className="p-1.5 text-gray-400 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full transition-colors ml-1"
              >
                {isPreviewFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
            </div>
          </div>

          {/* Preview content */}
          {draftConfig ? (
            <div className="flex-1 relative overflow-hidden mx-4 mb-4 rounded-xl bg-gray-100 dark:bg-slate-900">
              <div
                className="absolute overflow-hidden"
                style={showPhoneShell ? {
                  width: 280, height: 560,
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 34,
                  border: '10px solid #1e1e22',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.6)',
                  background: '#09090f',
                } : {
                  top: 0, right: 0, bottom: 0, left: 0,
                  borderRadius: 12,
                  border: '1px solid rgba(0,0,0,0.08)',
                  background: '#fff',
                }}
              >
                {showPhoneShell && (
                  <>
                    <div className="absolute left-1/2 -translate-x-1/2 top-[2.6%] w-2 h-2 rounded-full bg-[#050508] border border-white/10 z-10 pointer-events-none" />
                    <div className="absolute bottom-[2.8%] left-1/2 -translate-x-1/2 w-[28%] h-1 rounded-full bg-white/30 z-10 pointer-events-none" />
                  </>
                )}
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  onLoad={handleIframeLoad}
                  title="Preview"
                  style={showPhoneShell ? {
                    position: 'absolute', top: 0, left: 0, border: 'none',
                    transform: 'scale(0.72)', transformOrigin: 'top left',
                    width: '138.9%', height: '138.9%',
                  } : {
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    border: 'none', display: 'block',
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 mx-4 mb-4 border border-dashed border-gray-300/60 dark:border-slate-600/50 rounded-xl bg-white/40 dark:bg-slate-800/20 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
              <div
                className="absolute inset-0 opacity-[0.035]"
                style={{
                  backgroundImage: 'radial-gradient(#8b5cf6 1.5px, transparent 1.5px)',
                  backgroundSize: '28px 28px',
                }}
              />
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center mb-6 shadow-sm border border-gray-200/50 dark:border-slate-600/50 relative">
                <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-xl" />
                <Sparkles className="w-8 h-8 text-primary/25 relative z-10" />
              </div>
              <h2 className="font-semibold text-lg text-gray-600 dark:text-slate-300 mb-2">
                {t('aiBuilder.previewEmpty')}
              </h2>
              <p className="text-gray-400 dark:text-slate-500 text-sm leading-relaxed max-w-xs">
                {t('aiBuilder.previewEmptyDesc')}
              </p>
            </div>
          )}
        </section>

        {/* ── Chat panel (full width, content centered) ── */}
        <aside
          className={`flex-1 bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl border border-white/60 dark:border-slate-700/50 rounded-2xl shrink-0 shadow-lg overflow-hidden flex-col ${
            activeTab === 'chat' ? 'flex' : 'hidden'
          } md:flex`}
        >
          {/* Messages area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col scrollbar-thin">
            <div className="max-w-2xl mx-auto w-full flex flex-col gap-7">
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22 }}
                    className={msg.role === 'user'
                      ? `flex ${isRtl ? 'justify-start' : 'justify-end'}`
                      : `flex gap-3 max-w-[92%] ${isRtl ? 'flex-row-reverse self-end' : ''}`
                    }
                  >
                    {msg.role === 'assistant' ? (
                      <>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-violet-500/30 flex items-center justify-center shrink-0 shadow-sm border border-violet-200/50 dark:border-violet-700/30 mt-5">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className={`text-xs font-medium text-gray-400 dark:text-slate-500 ${isRtl ? 'me-1.5' : 'ms-1.5'}`}>
                            Lighty AI
                          </span>
                          <div className="bg-white/80 dark:bg-slate-700/80 backdrop-blur-sm px-5 py-4 text-gray-700 dark:text-slate-200 text-sm shadow-sm border border-gray-100 dark:border-slate-600/50 leading-relaxed rounded-3xl rounded-tl-sm">
                            {msg.content}
                          </div>
                          {/* Suggestion pills — first message only, before any user input */}
                          {i === 0 && !hasUserMessage && (
                            <div className={`flex flex-col gap-2 mt-1 ${isRtl ? 'items-end me-1' : 'items-start ms-1'}`}>
                              {suggestions.map((suggestion) => (
                                <button
                                  key={suggestion}
                                  onClick={() => handleSubmit(undefined, suggestion)}
                                  disabled={isGenerating}
                                  className={`px-5 py-2.5 text-sm bg-white/50 dark:bg-slate-800/50 border border-gray-200/60 dark:border-slate-600/50 rounded-full text-gray-500 dark:text-slate-400 hover:border-primary hover:text-primary dark:hover:border-violet-400 dark:hover:text-violet-300 hover:bg-white dark:hover:bg-slate-700 transition-all backdrop-blur-sm shadow-sm disabled:opacity-50 ${isRtl ? 'text-right' : 'text-left'}`}
                                >
                                  "{suggestion}"
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="max-w-[80%] bg-gradient-to-br from-primary to-violet-500 text-white px-5 py-4 text-sm shadow-md leading-relaxed rounded-3xl rounded-br-sm">
                        {msg.content}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isGenerating && <TypingIndicator isRtl={isRtl} />}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input area */}
          <div className="p-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md border-t border-gray-100/50 dark:border-slate-700/50 shrink-0">
            <div className="max-w-2xl mx-auto w-full">
              {/* Attached logo preview */}
              {logoFile && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/60 rounded-full px-4 py-2"
                >
                  <Paperclip className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1">{logoFile.name}</span>
                  <button
                    type="button"
                    onClick={() => setLogoFile(null)}
                    className="hover:text-red-500 transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="flex items-end gap-2 bg-gray-50/80 dark:bg-slate-700/50 border border-gray-200/60 dark:border-slate-600/50 rounded-[2rem] p-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 focus-within:bg-white dark:focus-within:bg-slate-700/80 transition-all">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-3 text-gray-400 dark:text-slate-500 hover:text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-full transition-colors shrink-0 mb-0.5"
                    title={t('aiBuilder.uploadLogo')}
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>

                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResizeTextarea(); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
                    }}
                    placeholder={t(draftConfig ? 'aiBuilder.refinePlaceholder' : 'aiBuilder.firstPromptPlaceholder')}
                    disabled={isGenerating}
                    rows={1}
                    className="flex-1 bg-transparent border-none focus:ring-0 outline-none resize-none py-3.5 px-2 text-sm text-gray-700 dark:text-slate-200 placeholder-gray-400 dark:placeholder-slate-500 min-h-[52px] max-h-[140px]"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isGenerating}
                    className="p-3.5 bg-gradient-to-r from-primary to-violet-500 text-white rounded-full disabled:opacity-40 hover:shadow-md hover:-translate-y-0.5 transition-all shrink-0 mb-0.5"
                  >
                    {isGenerating
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Send className="w-5 h-5" />
                    }
                  </button>
                </div>
              </form>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              />

              <p className="mt-3 text-center text-[11px] text-gray-400 dark:text-slate-500 tracking-wide">
                {t('aiBuilder.aiDisclaimer')}
              </p>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default AiBuilder;
