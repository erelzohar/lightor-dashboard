import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { addDays, startOfDay } from 'date-fns';
import Appointments from '../../pages/Appointments';
import appointmentsReducer from '../../store/slices/appointmentsSlice';
import webConfigReducer from '../../store/slices/webConfigSlice';
import { getAppointments } from '../../services/appointmentsApi';
import { localDateKey } from '../../utils/bookingSlots';
import type { Appointment, AppointmentType } from '../../types';

const { t, theme, authValue } = vi.hoisted(() => ({
  t: (key: string) => key,
  theme: { language: 'en', direction: 'ltr' },
  authValue: { auth: { user: { _id: 'u1', name: 'Owner' } } },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => theme }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/appointmentsApi', () => ({
  getAppointments: vi.fn(),
  getAppointmentTypes: vi.fn(async () => []),
  getClassSessions: vi.fn(async () => []),
  updateAppointmentStatus: vi.fn(),
}));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../components/appointments/ExportAppointmentsButton', () => ({ default: (): null => null }));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});

const HOUR = 3_600_000;
const service: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
// A month ahead, well outside the week the calendar opens on.
const later = addDays(startOfDay(new Date()), 30);
const booking = (id: string, name: string, day: Date): Appointment => ({
  _id: id,
  name,
  type: service,
  phone: '+972500000001',
  status: 'scheduled',
  user_id: 'u1',
  timestamp: String(new Date(day.getFullYear(), day.getMonth(), day.getDate(), 10).valueOf()),
});
const tomorrow = addDays(startOfDay(new Date()), 1);

/** Where the router is: the deep link's query must be gone once applied. */
const Search: React.FC = () => <span data-testid="search">{useLocation().search}</span>;
const GoTo: React.FC<{ to: string }> = ({ to }) => {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)}>go</button>;
};

const renderAt = (url: string, goTo?: string) => {
  const store = configureStore({
    reducer: combineReducers({ appointments: appointmentsReducer, webConfig: webConfigReducer }),
  });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[url]}>
        <Appointments />
        <Search />
        {goTo && <GoTo to={goTo} />}
      </MemoryRouter>
    </Provider>
  );
};

/** The calendar's day columns (the page's details modal sits outside them). */
const grid = () => document.querySelector('.min-h-0.overflow-y-auto') as HTMLElement;
const detailsOpen = () => screen.queryByText('appointments.markCompleted') !== null;

beforeEach(() => {
  window.innerWidth = 1280;
  vi.mocked(getAppointments).mockReset();
});

/**
 * Links into the calendar (LT-267): Lighty's answers link a day
 * (`/appointments?date=YYYY-MM-DD`), a push notification its booking
 * (`/appointments?focus=<id>`). The page used to ignore both.
 */
describe('the appointments page, opened from a link', () => {
  it('opens the calendar on the day a link names, then drops it from the URL', async () => {
    vi.mocked(getAppointments).mockResolvedValue([booking('a1', 'Dana Cohen', later)]);
    renderAt(`/appointments?date=${localDateKey(later)}`);

    await waitFor(() => expect(within(grid()).getAllByText('Dana Cohen').length).toBeGreaterThan(0));
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    expect(detailsOpen()).toBe(false);
  });

  it('lets the linked day go once the owner switches views by hand (LT-315)', async () => {
    vi.mocked(getAppointments).mockResolvedValue([booking('a1', 'Dana Cohen', later)]);
    renderAt(`/appointments?date=${localDateKey(later)}`);
    await waitFor(() => expect(within(grid()).getAllByText('Dana Cohen').length).toBeGreaterThan(0));

    // Radix tabs switch on mouse down.
    fireEvent.mouseDown(screen.getByRole('tab', { name: /appointments\.listView/ }));
    await waitFor(() => expect(grid()).toBeNull());
    fireEvent.mouseDown(screen.getByRole('tab', { name: /appointments\.calendarView/ }));
    await waitFor(() => expect(grid()).not.toBeNull());
    // Back on this week, a month before the linked day.
    expect(within(grid()).queryByText('Dana Cohen')).toBeNull();
  });

  it('opens the calendar for a day even when the owner keeps the list view', async () => {
    localStorage.setItem('appointments_view_mode', 'list');
    vi.mocked(getAppointments).mockResolvedValue([booking('a1', 'Dana Cohen', later)]);
    renderAt(`/appointments?date=${localDateKey(later)}`);

    await waitFor(() => expect(within(grid()).getAllByText('Dana Cohen').length).toBeGreaterThan(0));
  });

  it('ignores a day that is not a date', async () => {
    vi.mocked(getAppointments).mockResolvedValue([booking('a1', 'Dana Cohen', later)]);
    renderAt('/appointments?date=2026-02-31');

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(within(grid()).queryByText('Dana Cohen')).toBeNull();
  });

  it("opens a booking's details on its day once the book has it", async () => {
    vi.mocked(getAppointments).mockResolvedValue([
      booking('a1', 'Dana Cohen', tomorrow),
      booking('a2', 'Noa Levi', later),
    ]);
    renderAt('/appointments?focus=a2');

    await waitFor(() => expect(detailsOpen()).toBe(true));
    expect(screen.getAllByText('Noa Levi').length).toBeGreaterThan(0);
    // The calendar moves to the day in its own effect, a render after the
    // card opens: wait for it rather than catch the render in between.
    await waitFor(() => expect(within(grid()).getAllByText('Noa Levi').length).toBeGreaterThan(0));
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
    // The page's own load was awaited — not doubled.
    expect(getAppointments).toHaveBeenCalledTimes(1);
  });

  it('drops a booking the book does not have, opening nothing', async () => {
    vi.mocked(getAppointments).mockResolvedValue([booking('a1', 'Dana Cohen', tomorrow)]);
    renderAt('/appointments?focus=gone');

    await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent(/^$/));
    expect(detailsOpen()).toBe(false);
    expect(getAppointments).toHaveBeenCalledTimes(1);
  });

  it('reads the book again for a notification tapped while the page is open', async () => {
    vi.mocked(getAppointments)
      .mockResolvedValueOnce([booking('a1', 'Dana Cohen', tomorrow)])
      .mockResolvedValueOnce([booking('a1', 'Dana Cohen', tomorrow), booking('a3', 'Maya Bar', later)]);
    renderAt('/appointments', '/appointments?focus=a3');
    await waitFor(() => expect(getAppointments).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('appointments.title')).not.toBeNull());

    fireEvent.click(screen.getByText('go'));

    await waitFor(() => expect(detailsOpen()).toBe(true));
    expect(getAppointments).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Maya Bar').length).toBeGreaterThan(0);
    await waitFor(() => expect(within(grid()).getAllByText('Maya Bar').length).toBeGreaterThan(0));
    expect(screen.getByTestId('search')).toHaveTextContent(/^$/);
  });
});
