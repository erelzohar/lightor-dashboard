import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import ScheduleVacations from '../../pages/ScheduleVacations';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

/**
 * LT-702: Schedule and vacations - a vacation's start and end on the
 * business's clock: 12-hour for an American business in any language, as
 * before for an Israeli one. The working hours themselves are time inputs,
 * left as they are.
 */
const { t, theme } = vi.hoisted(() => ({
  t: (key: string, opts?: { returnObjects?: boolean }) =>
    opts?.returnObjects ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : key,
  theme: { direction: 'ltr', language: 'en', darkMode: false },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: theme.language } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => theme }));
const authValue = vi.hoisted(() => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('../../store/slices/vacationsSlice', () => ({ createVacation: vi.fn(), updateVacation: vi.fn(), deleteVacation: vi.fn() }));
const state = vi.hoisted(() => ({ webConfig: { data: null as unknown, loading: false, error: null as string | null } }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
// Stable, as the real one: the page's load effect depends on `dispatch`.
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const NY = 'America/New_York';
const vacation = {
  _id: 'v1',
  title: 'Away',
  startDate: String(Date.UTC(2030, 2, 4, 20, 0)), // 15:00 in New York
  endDate: String(Date.UTC(2030, 2, 6, 17, 0)), // 12:00 in New York
  webConfig_id: 'wc1',
};
const site = (phone: string) => ({
  _id: 'wc1',
  contact: { phone },
  timeZone: NY,
  workingDays: [null, null, null, null, null, null, null] as (string | null)[],
  dateOverrides: [] as unknown[],
  vacations: [vacation],
});
// The phone is read from the store around the page, as in the app.
const show = (phone: string) => {
  state.webConfig.data = site(phone);
  const store = configureStore({
    reducer: combineReducers({ webConfig: (s: unknown = state.webConfig) => s }),
  });
  render(<Provider store={store}><ScheduleVacations /></Provider>);
};
const FSI = '⁨';
const PDI = '⁩';

beforeEach(() => {
  theme.language = 'en';
  theme.direction = 'ltr';
});

describe("Schedule and vacations: a vacation's hours (LT-702)", () => {
  it('an American business in English: "March 4th, 2030 - 3:00 PM"', () => {
    show('+12125550142');
    expect(screen.getByText('scheduleVacations.fromMarch 4th, 2030 - 3:00 PM')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.toMarch 6th, 2030 - 12:00 PM')).toBeInTheDocument();
  });

  it('an American business in Hebrew: its Hebrew date, the 12-hour clock isolated', () => {
    theme.language = 'he';
    theme.direction = 'rtl';
    show('+12125550142');
    const day = format(new Date(2030, 2, 4), 'PPP', { locale: he });
    expect(screen.getByText(`scheduleVacations.from${day} - ${FSI}3:00 PM${PDI}`)).toBeInTheDocument();
  });

  it('an Israeli business in Hebrew: as before', () => {
    theme.language = 'he';
    theme.direction = 'rtl';
    show('+972501234567');
    const day = format(new Date(2030, 2, 4), 'PPP', { locale: he });
    expect(screen.getByText(`scheduleVacations.from${day} - 15:00`)).toBeInTheDocument();
  });
});
