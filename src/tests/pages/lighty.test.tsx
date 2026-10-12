import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LightyPage from '../../pages/Lighty';
import { assistantService } from '../../services/assistantApi';
import { FloatingAiAssistant } from '../../components/ui/glowing-ai-chat-assistant';
import { LightyText } from '../../components/lighty/LightyChat';

/**
 * LT-253 — Lighty's page: the conversation so far, ready questions, the
 * answer with its links and a hand-off to the site editor, the budget, a
 * fresh start; the floating Lighty that sends a question there; and his
 * text, rendered safely.
 */
const { t } = vi.hoisted(() => ({ t: (key: string, vars?: Record<string, unknown>) => (vars && 'percent' in vars ? `${key}:${vars.percent}` : key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'he' } }) }));
vi.mock('../../components/lighty/Lighty3D', () => ({ default: (): null => null }));
const { lightTick } = vi.hoisted(() => ({ lightTick: vi.fn() }));
vi.mock('../../lib/haptics', () => ({ lightTick }));
vi.mock('../../hooks/useVirtualKeyboard', () => ({ useVirtualKeyboard: () => false }));
vi.mock('../../services/entitlementsApi', () => ({
  fetchMyEntitlements: vi.fn(async () => ({ plan: 'plus', limits: { aiTokensPerMonth: 1000 }, usage: { aiTokensThisMonth: 250 } })),
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: { conversion: 'book' } } }),
}));
vi.mock('../../services/assistantApi', () => ({
  assistantService: { chat: vi.fn(), thread: vi.fn(), clear: vi.fn(async () => undefined) },
}));

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname}|{JSON.stringify(location.state)}</p>;
};
const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/lighty', state }]}>
      <Routes>
        <Route path="/lighty" element={<LightyPage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );

describe("Lighty's page (LT-253)", () => {
  beforeEach(() => {
    vi.mocked(assistantService.chat).mockReset();
    vi.mocked(assistantService.thread).mockReset().mockResolvedValue([]);
    vi.mocked(assistantService.clear).mockClear();
    lightTick.mockClear();
  });

  it('greets with ready questions; one sends, and the answer comes with its link', async () => {
    vi.mocked(assistantService.chat).mockResolvedValue({ reply: 'מחר יש לך **2 תורים**.\n- 10:00 דנה\n- 12:30 מיכל\n[ליומן](/appointments?date=2026-10-13)' });
    renderPage();
    expect(await screen.findByText('lighty.hello')).toBeInTheDocument();
    fireEvent.click(screen.getByText('lighty.suggest.today'));

    expect(assistantService.chat).toHaveBeenCalledWith('lighty.suggest.today');
    expect(await screen.findByText('2 תורים')).toHaveProperty('tagName', 'STRONG');
    expect(lightTick).toHaveBeenCalledTimes(1); // LT-268: Lighty answered
    expect(screen.getByText('10:00 דנה').tagName).toBe('LI');
    fireEvent.click(screen.getByRole('link', { name: 'ליומן' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/appointments');
  });

  it('hands a website request to the site editor', async () => {
    vi.mocked(assistantService.thread).mockResolvedValue([
      { role: 'user', content: 'Make the headline warmer' },
      { role: 'assistant', content: 'Opening the editor for you.', handoff: 'Make the headline warmer' },
    ]);
    renderPage();
    fireEvent.click(await screen.findByText('lighty.toEditor'));
    expect(screen.getByTestId('where')).toHaveTextContent('/design|{"floatingMessage":"Make the headline warmer"}');
  });

  it("sends the floating Lighty's question at once; says when the budget is spent; starts over", async () => {
    vi.mocked(assistantService.thread).mockResolvedValue([{ role: 'assistant', content: 'Earlier answer' }]);
    vi.mocked(assistantService.chat).mockRejectedValue({ response: { status: 429 } });
    renderPage({ lightyMessage: 'When am I free tomorrow?' });
    await waitFor(() => expect(assistantService.chat).toHaveBeenCalledWith('When am I free tomorrow?'));
    expect(await screen.findByRole('alert')).toHaveTextContent('lighty.budget');
    expect(lightTick).not.toHaveBeenCalled(); // a refusal is not an answer
    expect(screen.getByText('When am I free tomorrow?')).toBeInTheDocument();
    expect(screen.getByTitle('lighty.usage:25')).toBeInTheDocument();

    fireEvent.click(screen.getByText('lighty.newChat'));
    await waitFor(() => expect(assistantService.clear).toHaveBeenCalled());
    expect(await screen.findByText('lighty.hello')).toBeInTheDocument();
    expect(screen.queryByText('Earlier answer')).toBeNull();
  });

  it('sends with Enter, not with Shift+Enter', async () => {
    vi.mocked(assistantService.chat).mockResolvedValue({ reply: 'Hi' });
    renderPage();
    const box = await screen.findByRole('textbox', { name: 'lighty.placeholder' });
    fireEvent.change(box, { target: { value: 'line one' } });
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: true });
    expect(assistantService.chat).not.toHaveBeenCalled();
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(assistantService.chat).toHaveBeenCalledWith('line one');
  });
});

describe('the floating Lighty (LT-253)', () => {
  it('asks a ready question or opens his page', () => {
    const onSend = vi.fn();
    const onOpenPage = vi.fn();
    render(<FloatingAiAssistant onSend={onSend} onOpenPage={onOpenPage} />);
    fireEvent.click(screen.getByRole('button', { name: 'lighty.ask' }));
    expect(screen.getByText('lighty.floatingHello')).toBeInTheDocument();
    fireEvent.click(screen.getByText('lighty.suggest.week'));
    expect(onSend).toHaveBeenCalledWith('lighty.suggest.week');

    fireEvent.click(screen.getByRole('button', { name: 'lighty.ask' }));
    fireEvent.click(screen.getByText('lighty.openPage'));
    expect(onOpenPage).toHaveBeenCalled();
  });

  it("says the home page's greeting in a bubble; tapping it opens his card (LT-269)", () => {
    const { rerender } = render(<FloatingAiAssistant onSend={vi.fn()} greeting="Good afternoon, Erel" />);
    fireEvent.click(screen.getByText('Good afternoon, Erel'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    // While the card is open, the bubble steps aside.
    expect(screen.queryByText('Good afternoon, Erel')).toBeNull();

    rerender(<FloatingAiAssistant onSend={vi.fn()} />);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'lighty.close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Good afternoon, Erel')).toBeNull(); // other pages: no greeting
  });
});

describe("Lighty's text (LT-253)", () => {
  it('links only to the dashboard, and never renders HTML', () => {
    render(
      <MemoryRouter>
        <LightyText text={'[Leads](/leads) [admin](/admin/users) [x](https://evil.example) <img src=x onerror=alert(1)>'} />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Leads' })).toHaveAttribute('href', '/leads');
    expect(screen.queryByRole('link', { name: 'admin' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'x' })).toBeNull();
    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  });

  it('keeps a link that sits inside bold a link', () => {
    render(<MemoryRouter><LightyText text="אפשר ב**[שעות וחופשות](/schedule-vacations)** בכל רגע." /></MemoryRouter>);
    const link = screen.getByRole('link', { name: 'שעות וחופשות' });
    expect(link).toHaveAttribute('href', '/schedule-vacations');
    expect(link.closest('strong')).not.toBeNull();
    expect(screen.queryByText(/\]\(/)).toBeNull();
  });
});
