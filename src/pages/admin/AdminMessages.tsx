import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Megaphone } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import AudiencePicker, {
  AUDIENCE_FILTERS,
  AudienceState,
  emptyAudience,
  isolate,
  LANGUAGE_NAMES,
  toApiAudience,
} from '../../components/admin/AudiencePicker';
import {
  countSystemMessageAudience,
  fetchSystemMessages,
  sendSystemMessage,
  SystemMessageRow,
} from '../../services/adminApi';

const TITLE_MAX = 120;
const BODY_MAX = 1000;

type SummaryInput = NonNullable<SystemMessageRow['audience']>;

/**
 * Admin → System message (LT-534): one text to every account or to the
 * audience picked (LT-543), on each recipient's Notifications page and, when
 * asked for, on their phones. It cannot be taken back, so the send asks first
 * and says how many accounts it reaches and who they are.
 */
const AdminMessages: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [who, setWho] = useState<AudienceState>(emptyAudience);
  const [reach, setReach] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [push, setPush] = useState(false);
  const [sent, setSent] = useState<SystemMessageRow[]>([]);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);

  document.title = t('admin.messages.title');

  const load = useCallback(async () => {
    try {
      const result = await fetchSystemMessages();
      setSent(result.data);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const apiAudience = toApiAudience(who);
  const audienceKey = JSON.stringify(apiAudience);
  const pickedNobody = who.mode === 'accounts' && who.accounts.length === 0;

  // The count follows the picker, a moment after it settles.
  useEffect(() => {
    if (pickedNobody) {
      setReach(0);
      return;
    }
    setReach(null);
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const n = await countSystemMessageAudience(JSON.parse(audienceKey));
        if (live) setReach(n);
      } catch {
        if (live) setReach(null);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [audienceKey, pickedNobody]);

  /** "Everyone", the named accounts, or the filters picked, and who is left out. */
  const summary = (audience: SummaryInput | undefined): string => {
    const parts: string[] = [];
    if (audience?.accounts?.length) {
      parts.push(audience.accounts.map((a) => isolate(a.name || a.email)).join(', '));
    } else {
      for (const { key } of AUDIENCE_FILTERS) {
        const values = audience?.[key] ?? [];
        if (values.length === 0) continue;
        const labels = values.map((v) => isolate(key === 'languages' ? LANGUAGE_NAMES[v] : t(`admin.messages.audience.${key}.${v}`)));
        parts.push(`${t(`admin.messages.audience.${key}.label`)}: ${labels.join(' / ')}`);
      }
      if (parts.length === 0) parts.push(t('admin.messages.audience.everyone'));
    }
    if (audience?.exclude?.length) {
      parts.push(t('admin.messages.audience.without', { names: audience.exclude.map((a) => isolate(a.name || a.email)).join(', ') }));
    }
    return parts.join(' · ');
  };

  const send = async () => {
    setSending(true);
    try {
      const message = await sendSystemMessage({ title: title.trim(), body: body.trim(), push, audience: apiAudience });
      toast.success(t('admin.messages.sent', { n: message.recipients }));
      setTitle('');
      setBody('');
      setPush(false);
      setWho(emptyAudience());
      setAsking(false);
      await load();
    } catch {
      toast.error(t('admin.errors.actionFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-text">{t('admin.messages.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.messages.subtitle')}</p>
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-surface p-4">
        <Input
          label={t('admin.messages.titleLabel')}
          value={title}
          maxLength={TITLE_MAX}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="system-message-title"
        />
        <div>
          <label htmlFor="system-message-body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t('admin.messages.bodyLabel')}
          </label>
          <textarea
            id="system-message-body"
            value={body}
            maxLength={BODY_MAX}
            rows={4}
            onChange={(e) => setBody(e.target.value)}
            data-testid="system-message-body"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <AudiencePicker value={who} onChange={setWho} />
        <p className="text-sm font-medium text-gray-900 dark:text-dark-text" data-testid="audience-count" aria-live="polite">
          {reach === null ? t('admin.messages.audience.counting') : t('admin.messages.audience.count', { n: reach })}
        </p>
        <div>
          <ToggleSwitch checked={push} onChange={setPush} label={t('admin.messages.pushLabel')} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('admin.messages.pushHint')}</p>
        </div>
        <Button
          onClick={() => setAsking(true)}
          disabled={!title.trim() || !body.trim() || !reach}
          data-testid="system-message-send"
        >
          <Megaphone size={16} className="me-2" />
          {t('admin.messages.send')}
        </Button>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 dark:text-dark-text mb-2">{t('admin.messages.historyTitle')}</h2>
        {sent.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.messages.empty')}</p>
        ) : (
          <ul className="space-y-2">
            {sent.map((message) => (
              <li key={message._id} data-testid="system-message-row" className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-dark-surface p-3.5">
                <p className="font-semibold text-sm text-gray-900 dark:text-dark-text break-words">{message.title}</p>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-0.5 whitespace-pre-line break-words">{message.body}</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 break-words" data-testid="system-message-audience">
                  {summary(message.audience)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {new Date(message.createdAt).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}
                  {t('admin.messages.recipients', { n: message.recipients })}
                  {message.push && ` · ${t('admin.messages.pushed', { n: message.pushed })}`}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={asking}
        title={t('admin.messages.confirmTitle')}
        message={
          <>
            <span className="block">{t('admin.messages.confirm', { n: reach ?? 0 })}</span>
            <span className="block mt-1 break-words">{summary({ ...apiAudience, accounts: who.mode === 'accounts' ? who.accounts : undefined, exclude: who.exclude })}</span>
          </>
        }
        confirmLabel={t('admin.messages.send')}
        loading={sending}
        onConfirm={() => void send()}
        onClose={() => setAsking(false)}
      />
    </motion.div>
  );
};

export default AdminMessages;
