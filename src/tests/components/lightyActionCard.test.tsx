import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import he from '../../i18n/locales/he.json';
import en from '../../i18n/locales/en.json';
import ar from '../../i18n/locales/ar.json';
import es from '../../i18n/locales/es.json';
import fr from '../../i18n/locales/fr.json';
import { LightyActionCard } from '../../components/lighty/LightyActionCard';
import { assistantService, type LightyAction } from '../../services/assistantApi';

/**
 * LT-561 — the card of a change Lighty proposed: what it does, in the
 * owner's words, whether customers hear of it, and Confirm / No; then how
 * it ended. Rendered with the real Hebrew texts, so a missing key shows.
 */
const { lang } = vi.hoisted(() => ({ lang: { current: 'he' } }));
const lookup = (dict: unknown, key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict);
const t = (key: string, vars: Record<string, unknown> = {}) => {
  const found = lookup(he, key);
  if (typeof found !== 'string') return `MISSING:${key}`;
  return found.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ''));
};
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: lang.current } }) }));
vi.mock('../../services/assistantApi', () => ({
  assistantService: { confirm: vi.fn(), decline: vi.fn(), undo: vi.fn() },
}));

const soon = () => new Date(Date.now() + 10 * 60_000).toISOString();
const card = (over: Partial<LightyAction>): LightyAction => ({
  id: 'a1',
  kind: 'appointment_cancel',
  card: { items: [{ customer: 'דנה כהן', service: 'ג׳ל', date: '2026-11-10', time: '11:00' }], texts: 1, notes: [] },
  status: 'pending',
  expiresAt: soon(),
  ...over,
});

describe("Lighty's action card (LT-561)", () => {
  beforeEach(() => {
    lang.current = 'he';
    vi.mocked(assistantService.confirm).mockReset();
    vi.mocked(assistantService.decline).mockReset();
    vi.mocked(assistantService.undo).mockReset();
  });

  it('says what will happen and who hears of it, and changes nothing until Confirm', async () => {
    const onChange = vi.fn();
    vi.mocked(assistantService.confirm).mockResolvedValue(card({ status: 'done' }));
    render(<LightyActionCard action={card({})} onChange={onChange} />);
    expect(screen.getByText('ביטול תור')).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent(/דנה כהן.*11:00.*ג׳ל/);
    expect(screen.getByText('הלקוח יקבל הודעה על זה ב-SMS או WhatsApp.')).toBeInTheDocument();
    expect(assistantService.confirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'done' })));
    expect(assistantService.confirm).toHaveBeenCalledWith('a1');
  });

  it('No declines it', async () => {
    const onChange = vi.fn();
    vi.mocked(assistantService.decline).mockResolvedValue(card({ status: 'declined' }));
    render(<LightyActionCard action={card({})} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'לא' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'declined' })));
  });

  it('a done change that texted no one can be undone while its time lasts', async () => {
    const onChange = vi.fn();
    vi.mocked(assistantService.undo).mockResolvedValue(card({ status: 'undone' }));
    render(<LightyActionCard action={card({ kind: 'vacation_add', card: { items: [{ title: 'חופשה', from: '2026-11-10', to: '2026-11-12' }], texts: 0, notes: [] }, status: 'done', undoUntil: soon() })} onChange={onChange} />);
    expect(screen.getByText('בוצע')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'אישור' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ביטול השינוי' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'undone' })));
  });

  it('a done change with no undo time left shows no undo', () => {
    render(<LightyActionCard action={card({ status: 'done', undoUntil: new Date(Date.now() - 1000).toISOString() })} onChange={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'ביטול השינוי' })).toBeNull();
  });

  it('a pending card past its time reads expired, with nothing to press', () => {
    render(<LightyActionCard action={card({ expiresAt: new Date(Date.now() - 1000).toISOString() })} onChange={vi.fn()} />);
    expect(screen.getByText(/עבר הזמן לאישור, ושום דבר לא השתנה/)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a failed card says why, and that nothing changed', () => {
    render(<LightyActionCard action={card({ status: 'failed', failure: 'changed' })} onChange={vi.fn()} />);
    expect(screen.getByText(/משהו השתנה בינתיים/)).toBeInTheDocument();
  });

  it('a network failure leaves the card as it was, and says so', async () => {
    vi.mocked(assistantService.confirm).mockRejectedValue(new Error('offline'));
    const onChange = vi.fn();
    render(<LightyActionCard action={card({})} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'אישור' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('לא הצלחנו לשלוח את התשובה');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('draws every kind with the warnings, hours left to right, and arrows in the line\'s direction', () => {
    const kinds: LightyAction[] = [
      card({ kind: 'hours', card: { items: [{ weekday: 5, before: null, after: '09:00-13:00' }, { date: '2026-11-20', before: '09:00-17:00', after: null }], texts: 0, notes: [{ key: 'bookingsInside', count: 2 }] } }),
      card({ id: 'b', kind: 'booking_rules', card: { items: [{ rule: 'cancelUntilMinutes', was: 60, becomes: 1440 }, { rule: 'bookAheadDays', was: 60, becomes: 30 }], texts: 0, notes: [] } }),
      card({ id: 'c', kind: 'appointment_move', card: { items: [{ customer: 'דנה', service: 'ג׳ל', date: '2026-11-10', time: '10:00', newDate: '2026-11-10', newTime: '14:00' }], texts: 1, notes: [{ key: 'outsideHours' }] } }),
      card({ id: 'd', kind: 'appointment_book', card: { items: [{ customer: 'דנה', phone: '050-1234567', service: 'ג׳ל', date: '2026-11-10', time: '10:00' }], texts: 1, notes: [] } }),
      card({ id: 'e', kind: 'lead_status', card: { items: [{ customer: 'אבי', previous: 'new', status: 'closed' }, { customer: 'בת', previous: 'contacted', status: 'closed' }], texts: 0, notes: [] } }),
      card({ id: 'f', kind: 'customer_block', card: { items: [{ customer: 'דנה', block: true, reason: 'לא הגיעה' }], texts: 2, notes: [{ key: 'upcomingCancelled', count: 2 }] } }),
      card({ id: 'g', kind: 'customer_note', card: { items: [{ customer: 'דנה', note: 'מעדיפה בוקר' }], texts: 0, notes: [] } }),
      card({ id: 'h', kind: 'lead_to_customer', card: { items: [{ customer: 'נועה', received: '2026-11-01 09:30' }], texts: 0, notes: [] } }),
      card({ id: 'i', kind: 'appointment_complete', card: { items: [{ customer: 'דנה', service: 'ג׳ל', date: '2026-11-01', time: '10:00' }, { customer: 'מיכל', service: 'ג׳ל', date: '2026-11-01', time: '11:00' }], texts: 0, notes: [] } }),
      card({ id: 'j', kind: 'vacation_remove', card: { items: [{ title: 'חופשה', from: '2026-11-10', to: '2026-11-10' }], texts: 0, notes: [] } }),
    ];
    const { container } = render(<>{kinds.map((k) => <LightyActionCard key={k.id} action={k} onChange={vi.fn()} />)}</>);
    expect(container.textContent).not.toContain('MISSING:');
    // Every range its own left-to-right chip, after the arrow; closed a chip of its own (LT-562).
    const friday = screen.getAllByRole('listitem')[0];
    expect(friday).toHaveTextContent(/יום שישי.*סגור.*←.*09:00–13:00/);
    expect([...friday.querySelectorAll('[dir="ltr"]')].map((c) => c.textContent)).toEqual(['09:00–13:00']);
    expect(container.textContent).toContain('תורים שכבר נקבעו בזמן הזה נשארים: 2');
    expect(container.textContent).toMatch(/חלון הביטול לפני התורשעה.*←.*24 שעות/);
    expect(container.textContent).toMatch(/קביעת תורים מראש60 ימים.*←.*30 ימים/);
    expect(container.textContent).toContain('השעה מחוץ לשעות הפעילות.');
    expect(container.textContent).toContain('050-1234567');
    expect(container.textContent).toContain('שינוי סטטוס של 2 לידים');
    expect(container.textContent).toMatch(/אביחדש.*←.*סגור/);
    expect(container.textContent).toContain('חסימת לקוח');
    expect(container.textContent).toContain('סיבה: לא הגיעה');
    expect(container.textContent).toContain('2 לקוחות יקבלו הודעה');
    expect(container.textContent).toContain('סימון 2 תורים כהושלמו');
    expect(container.textContent).toContain('מעדיפה בוקר');

    lang.current = 'en';
    const { container: english } = render(<LightyActionCard action={kinds[0]} onChange={vi.fn()} />);
    expect(english.textContent).toContain('→');
  });

  it('has every card text in every language', () => {
    const keys = (o: unknown, path = ''): string[] =>
      o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, path ? `${path}.${k}` : k)) : [path];
    const hebrew = keys(he.lighty.action).sort();
    for (const dict of [en, ar, es, fr]) expect(keys(dict.lighty.action).sort()).toEqual(hebrew);
    for (const dict of [he, en, ar, es, fr]) {
      expect(typeof dict.lighty.suggest.blockDay).toBe('string');
      expect(JSON.stringify(dict.lighty)).not.toContain('—');
    }
  });
  it('splits a day of several ranges into chips that each read left to right', () => {
    render(<LightyActionCard action={card({ kind: 'hours', card: { items: [{ date: '2026-11-06', before: '09:00-11:00,12:00-14:00', after: null }], texts: 0, notes: [] } })} onChange={vi.fn()} />);
    const item = screen.getByRole('listitem');
    expect([...item.querySelectorAll('[dir="ltr"]')].map((c) => c.textContent)).toEqual(['09:00–11:00', '12:00–14:00']);
    expect(item).toHaveTextContent(/09:00–11:00.*12:00–14:00.*←.*סגור/);
  });
  // LT-564: phase 2's kinds - fields now and after, an add shows only what it will be.
  it("draws a service, a product, the alerts and the business's details", () => {
    const kinds: LightyAction[] = [
      card({ id: 's1', kind: 'service_add', card: { items: [{ subject: 'ג׳ל', field: 'price', before: null, after: '150' }, { subject: 'ג׳ל', field: 'minutes', before: null, after: '45' }], texts: 0, notes: [] } }),
      card({ id: 's2', kind: 'service_edit', card: { items: [{ subject: 'ג׳ל', field: 'price', before: '150', after: '170' }], texts: 0, notes: [] } }),
      card({ id: 'p1', kind: 'product_add', card: { items: [{ subject: 'נר', field: 'price', before: null, after: '49.9 ₪' }, { subject: 'נר', field: 'show', before: null, after: 'no' }], texts: 0, notes: [{ key: 'noPicture' }, { key: 'draftProduct' }] } }),
      card({ id: 'p2', kind: 'product_edit', card: { items: [{ subject: 'נר', field: 'soldOut', before: 'no', after: 'yes' }], texts: 0, notes: [] } }),
      card({ id: 'a1', kind: 'alerts', card: { items: [{ event: 'cancellation', channel: 'phone', before: 'off', after: 'on' }], texts: 0, notes: [] } }),
      card({ id: 'b1', kind: 'business_details', card: { items: [{ field: 'city', before: 'תל אביב', after: 'חיפה' }, { field: 'instagram', before: null, after: 'https://instagram.com/noy' }], texts: 0, notes: [] } }),
    ];
    const { container } = render(<>{kinds.map((k) => <LightyActionCard key={k.id} action={k} onChange={vi.fn()} />)}</>);
    const text = container.textContent ?? '';
    expect(text).not.toContain('MISSING:');
    expect(text).toContain('הוספת שירות: ג׳ל');
    expect(text).toMatch(/מחיר150משך45 דקות/);
    expect(text).toMatch(/שינוי שירות: ג׳למחיר150.*←.*170/);
    expect(text).toContain('הוספת מוצר: נר');
    expect(text).toContain('טיוטה');
    expect(text).toContain('תמונות מוסיפים בדף המוצרים.');
    expect(text).toMatch(/מלאיבמלאי.*←.*אזל מהמלאי/);
    expect(text).toMatch(/ביטול תורב-WhatsApp:כבוי.*←.*פעיל/);
    expect(text).toMatch(/עירתל אביב.*←.*חיפה/);
    expect(container.querySelector('span[dir="ltr"]')).not.toBeNull();
  });
});
