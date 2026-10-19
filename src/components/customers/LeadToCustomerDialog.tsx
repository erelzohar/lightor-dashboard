import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { UserPlus, Search, Check } from 'lucide-react';
import Input from '../ui/Input';
import PhoneInput from '../ui/PhoneInput';
import Button from '../ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/segmented-tabs';
import { useDialogFocus } from '../../hooks/useDialogFocus';
import { addLeadToCustomer, type Lead } from '../../services/leadsApi';
import { fetchCustomers, isApiErrorCode, type CustomerRow } from '../../services/customersApi';
import { formatPhoneForDisplay, toE164 } from '../../utils/phone';
import { cn } from '../../lib/utils';

/**
 * "Add to customers" for a lead (LT-382). Erel: a lead stays a lead, with an
 * option to make it a customer or add it to one. Two ways in:
 * - a new customer, from the lead's name and phone (both can be fixed);
 * - an existing customer, picked from a search, when the same person wrote
 *   from another number.
 * A number that is already a customer is said so, with a way to its card.
 */
interface LeadToCustomerDialogProps {
  /** The lead to add; null when closed. */
  lead: Lead | null;
  onClose: () => void;
  /** The lead now belongs to this customer. */
  onAdded: (customerId: string) => void;
  /** Open a customer's card (the number was already a customer). */
  onOpenCustomer: (customerId: string) => void;
}

type Mode = 'new' | 'existing';

const LeadToCustomerDialog: React.FC<LeadToCustomerDialogProps> = ({ lead, onClose, onAdded, onOpenCustomer }) => {
  const { t } = useTranslation();
  const open = lead !== null;
  const [mode, setMode] = useState<Mode>('new');
  const [form, setForm] = useState({ name: '', phone: '', notes: '' });
  // The phone field's own error shows once a save was tried (LT-407).
  const [tried, setTried] = useState(false);
  const [existsId, setExistsId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<CustomerRow[] | null>(null);
  const [picked, setPicked] = useState<CustomerRow | null>(null);
  const [saving, setSaving] = useState(false);

  // A fresh start for each lead: its own details, nothing picked.
  useEffect(() => {
    if (!lead) return;
    setMode('new');
    setForm({ name: lead.name.slice(0, 50), phone: lead.phone, notes: '' });
    setTried(false);
    setExistsId(null);
    setSearch('');
    setResults(null);
    setPicked(null);
  }, [lead]);

  // The search, a beat after typing stops; with nothing typed, the latest
  // customers. A slower answer to an older search never wins.
  const searchSeq = useRef(0);
  useEffect(() => {
    if (!open || mode !== 'existing') return;
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const page = await fetchCustomers({ search: search.trim() || undefined, limit: 8, sort: 'lastSeenAt', order: 'desc' });
        if (seq === searchSeq.current) setResults(page.data);
      } catch {
        if (seq === searchSeq.current) setResults([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, mode, search]);

  const failed = (error: unknown) => {
    const serverMessage = (error as { response?: { data?: { error?: string } } })?.response?.data?.error;
    toast.error(serverMessage || t('leads.toCustomer.failed'));
  };

  const addNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    // A valid number, Israeli or with its country code (LT-407).
    if (!toE164(form.phone)) {
      setTried(true);
      return;
    }
    setSaving(true);
    setExistsId(null);
    try {
      const customer = await addLeadToCustomer(lead._id, {
        name: form.name.trim(),
        // In E.164, also when the lead's own number was kept as it came (LT-407).
        phone: toE164(form.phone) ?? form.phone.trim(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      toast.success(t('leads.toCustomer.added'));
      onAdded(customer._id);
    } catch (error) {
      if (isApiErrorCode(error, 'CUSTOMER_EXISTS')) {
        setExistsId((error as { response?: { data?: { customerId?: string } } }).response?.data?.customerId ?? null);
      } else {
        failed(error);
      }
    } finally {
      setSaving(false);
    }
  };

  const addToPicked = async () => {
    if (!lead || !picked) return;
    setSaving(true);
    try {
      await addLeadToCustomer(lead._id, { customerId: picked._id });
      toast.success(t('leads.toCustomer.attached', { name: picked.name }));
      onAdded(picked._id);
    } catch (error) {
      failed(error);
    } finally {
      setSaving(false);
    }
  };

  // A real dialog (LT-362): focus in, Tab kept inside, Escape closes (not
  // mid-save), focus back.
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const notesId = useId();
  useDialogFocus(open, panelRef, () => { if (!saving) onClose(); });

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-safe">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md glass-modal rounded-2xl p-6 max-h-[90dvh] overflow-y-auto"
          >
            <h3 id={titleId} className="text-lg font-bold text-gray-900 dark:text-dark-text flex items-center gap-2 mb-4">
              <UserPlus size={18} className="text-primary" aria-hidden="true" />
              {t('leads.toCustomer.title')}
            </h3>

            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList aria-label={t('leads.toCustomer.title')} className="w-full mb-4">
                <TabsTrigger value="new" className="flex-1">{t('leads.toCustomer.new')}</TabsTrigger>
                <TabsTrigger value="existing" className="flex-1">{t('leads.toCustomer.existing')}</TabsTrigger>
              </TabsList>

              <TabsContent value="new">
                <form onSubmit={addNew} className="space-y-4">
                  <Input
                    label={t('customers.add.name')}
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    maxLength={50}
                  />
                  <PhoneInput
                    label={t('customers.add.phone')}
                    accept="world"
                    value={form.phone}
                    onChange={(phone) => {
                      setForm((prev) => ({ ...prev, phone }));
                      setExistsId(null);
                    }}
                    showError={tried}
                    required
                  />
                  {existsId && (
                    <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 p-3 text-sm text-amber-800 dark:text-amber-200 space-y-2" role="alert">
                      <p>{t('leads.toCustomer.exists')}</p>
                      <button
                        type="button"
                        onClick={() => onOpenCustomer(existsId)}
                        className="font-semibold text-primary hover:underline"
                      >
                        {t('leads.toCustomer.openExisting')}
                      </button>
                    </div>
                  )}
                  <div>
                    <label htmlFor={notesId} className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                      {t('customers.add.notes')}
                    </label>
                    <textarea
                      id={notesId}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      maxLength={2000}
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-y"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                      {t('customers.block.cancel')}
                    </Button>
                    <Button type="submit" variant="primary" size="sm" isLoading={saving}>
                      {t('leads.toCustomer.addNew')}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="existing">
                <div className="space-y-3">
                  <Input
                    aria-label={t('customers.search')}
                    placeholder={t('customers.search')}
                    leftIcon={<Search size={16} />}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {results === null ? (
                    <div className="space-y-2" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="h-12 rounded-xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
                      ))}
                    </div>
                  ) : results.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      {t(search.trim() ? 'customers.noMatch' : 'leads.toCustomer.noCustomers')}
                    </p>
                  ) : (
                    <ul className="space-y-1.5" aria-label={t('leads.toCustomer.pick')}>
                      {results.map((c) => {
                        const chosen = picked?._id === c._id;
                        return (
                          <li key={c._id}>
                            <button
                              type="button"
                              aria-pressed={chosen}
                              onClick={() => setPicked(c)}
                              className={cn(
                                'w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-start transition-colors',
                                chosen
                                  ? 'border-primary bg-primary/5 dark:bg-primary/10'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                              )}
                            >
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-semibold text-gray-900 dark:text-dark-text truncate">{c.name}</span>
                                <span className="block text-xs text-gray-500 dark:text-gray-400" dir="ltr">
                                  {formatPhoneForDisplay(c.phone)}
                                </span>
                              </span>
                              {chosen && <Check size={16} className="text-primary shrink-0" aria-hidden="true" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
                      {t('customers.block.cancel')}
                    </Button>
                    <Button type="button" variant="primary" size="sm" isLoading={saving} disabled={!picked} onClick={() => void addToPicked()}>
                      {t('leads.toCustomer.addToPicked')}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default LeadToCustomerDialog;
