import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Megaphone } from 'lucide-react';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Input from '../../components/ui/Input';
import ToggleSwitch from '../../components/ui/ToggleSwitch';
import { fetchSystemMessages, sendSystemMessage, SystemMessageRow } from '../../services/adminApi';

const TITLE_MAX = 120;
const BODY_MAX = 1000;

/**
 * Admin → System message (LT-534): one text to every account, on each owner's
 * Notifications page and, when asked for, on their phones. It cannot be taken
 * back, so the send asks first and says how many accounts it reaches.
 */
const AdminMessages: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [push, setPush] = useState(false);
  const [sent, setSent] = useState<SystemMessageRow[]>([]);
  const [audience, setAudience] = useState<number | null>(null);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);

  document.title = t('admin.messages.title');

  const load = useCallback(async () => {
    try {
      const result = await fetchSystemMessages();
      setSent(result.data);
      setAudience(result.audience);
    } catch {
      toast.error(t('admin.errors.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    setSending(true);
    try {
      const message = await sendSystemMessage({ title: title.trim(), body: body.trim(), push });
      toast.success(t('admin.messages.sent', { n: message.recipients }));
      setTitle('');
      setBody('');
      setPush(false);
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
        <div>
          <ToggleSwitch checked={push} onChange={setPush} label={t('admin.messages.pushLabel')} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t('admin.messages.pushHint')}</p>
        </div>
        <Button onClick={() => setAsking(true)} disabled={!title.trim() || !body.trim()} data-testid="system-message-send">
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
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
        message={t('admin.messages.confirm', { n: audience ?? 0 })}
        confirmLabel={t('admin.messages.send')}
        loading={sending}
        onConfirm={() => void send()}
        onClose={() => setAsking(false)}
      />
    </motion.div>
  );
};

export default AdminMessages;
