import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppointmentsGraph from '../../components/dashboard/AppointmentsGraph';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ language: 'he', direction: 'rtl', darkMode: false }) }));
vi.mock('../../hooks/useCurrencySymbol', () => ({ useCurrencySymbol: () => '₪' }));
// recharts' ResponsiveContainer measures with it; jsdom has none.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver;

/**
 * LT-423 (the exploratory pass): in Hebrew the home chart's right arrow went
 * forward - its icon was mirrored for RTL and its handler swapped too. The
 * start-side button goes back now, as the calendar's does, and each has a name.
 */
describe("the home chart's period buttons", () => {
  it('in Hebrew: the first (right) button goes back, the last forward, and all three have names', () => {
    const now = new Date(2026, 9, 19);
    const onCurrentDateChange = vi.fn();
    render(
      <AppointmentsGraph appointments={[]} timeRange="week" currentDate={now} onTimeRangeChange={vi.fn()} onCurrentDateChange={onCurrentDateChange} />
    );
    const named = screen.getAllByRole('button').filter((b) => /Period|graph\.reset/.test(b.getAttribute('aria-label') ?? ''));
    // In order: the start side (right in Hebrew) first.
    expect(named.map((b) => b.getAttribute('aria-label'))).toEqual(['appointments.calendar.prevPeriod', 'dashboard.graph.reset', 'appointments.calendar.nextPeriod']);

    fireEvent.click(named[0]);
    expect((onCurrentDateChange.mock.calls[0][0] as Date).getTime()).toBeLessThan(now.getTime());
    fireEvent.click(named[2]);
    expect((onCurrentDateChange.mock.calls[1][0] as Date).getTime()).toBeGreaterThan(now.getTime());
  });
});
