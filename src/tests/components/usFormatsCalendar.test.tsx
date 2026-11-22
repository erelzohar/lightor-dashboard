import React from 'react';
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import webConfigReducer from '../../store/slices/webConfigSlice';
import AppointmentCalendar from '../../components/appointments/AppointmentCalendar';
import AppointmentsList from '../../components/appointments/AppointmentsList';
import { DayTimes } from '../../components/customers/BookingSteps';
import { Appointment, AppointmentType } from '../../types';

/**
 * LT-702: an American business (its business phone in the United States)
 * reads the 12-hour clock in the calendar, the appointments list and the
 * owner's booking chips; an Israeli business reads them as before.
 */
const { t, theme } = vi.hoisted(() => ({
  t: (key: string) => key,
  theme: { language: 'en', direction: 'ltr' },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: theme.language } }) }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => theme }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth: { user: { _id: 'u1', name: 'Owner' } } }) }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => vi.fn() }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown): unknown =>
    selector({ webConfig: { data: null }, appointments: { appointmentTypes: [] } }),
}));
vi.mock('../../services/appointmentsApi', () => ({ getClassSessions: vi.fn() }));
vi.mock('../../store/slices/appointmentsSlice', () => ({
  updateAppointmentStatus: vi.fn(() => ({ type: 'noop' })),
  fetchAppointmentTypes: vi.fn(() => ({ type: 'noop' })),
}));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../components/customers/OwnerBookingModal', () => ({ default: (): null => null }));
vi.mock('../../lib/haptics', () => ({ lightTick: vi.fn(), impact: vi.fn() }));

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn();
});
beforeEach(() => {
  theme.language = 'en';
  theme.direction = 'ltr';
  localStorage.clear();
});

const US = '+12125550142';
const IL = '+972501234567';
const storeFor = (phone: string) =>
  configureStore({
    reducer: combineReducers({ webConfig: webConfigReducer }),
    preloadedState: { webConfig: { data: { _id: 'wc1', contact: { phone } }, loading: false, error: null } } as never,
  });
const inStore = (phone: string, ui: React.ReactElement) => render(<Provider store={storeFor(phone)}>{ui}</Provider>);

const HOUR = 3_600_000;
const service: AppointmentType = { _id: 's1', name: 'Gel manicure', webConfig_id: 'w1', price: '140', durationMS: String(HOUR) };
const tomorrowAt = (hour: number) => {
  const now = new Date();
  return String(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, hour).valueOf());
};
const booking = (id: string, name: string, timestamp: string): Appointment => ({
  _id: id, name, type: service, phone: '+12125550101', status: 'scheduled', user_id: 'u1', timestamp,
});
const FSI = '⁨';
const PDI = '⁩';

describe('the calendar (LT-702)', () => {
  it("an American business: the hour column and the appointment's time on the 12-hour clock", () => {
    inStore(US, <AppointmentCalendar appointments={[booking('a1', 'Dana Miller', tomorrowAt(15))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByTestId('next-appt-when')).toHaveTextContent('Tomorrow · 3:00 PM – 4:00 PM');
    expect(screen.getAllByText('3 PM').length).toBeGreaterThan(0);
    expect(screen.queryByText('15:00')).toBeNull();
  });

  it('an Israeli business: as before', () => {
    inStore(IL, <AppointmentCalendar appointments={[booking('a1', 'Dana Cohen', tomorrowAt(15))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByTestId('next-appt-when')).toHaveTextContent('Tomorrow · 15:00 – 16:00');
    expect(screen.getAllByText('15:00').length).toBeGreaterThan(0);
    expect(screen.queryByText('3 PM')).toBeNull();
  });

  it('an American business in Hebrew: the clock isolated, so it does not flip', () => {
    theme.language = 'he';
    theme.direction = 'rtl';
    inStore(US, <AppointmentCalendar appointments={[booking('a1', 'Dana Miller', tomorrowAt(15))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByTestId('next-appt-when').textContent).toContain(`${FSI}3:00 PM${PDI} – ${FSI}4:00 PM${PDI}`);
    expect(screen.getAllByText(`${FSI}3 PM${PDI}`).length).toBeGreaterThan(0);
  });
});

describe('the appointments list (LT-702)', () => {
  it('an American business: "Tomorrow, 3:00 PM"', () => {
    inStore(US, <AppointmentsList appointments={[booking('a1', 'Dana Miller', tomorrowAt(15))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByText('appointments.tomorrow, 3:00 PM')).toBeInTheDocument();
  });

  it('an Israeli business: "Tomorrow, 15:00"', () => {
    inStore(IL, <AppointmentsList appointments={[booking('a1', 'Dana Cohen', tomorrowAt(15))]} onAppointmentClick={vi.fn()} />);
    expect(screen.getByText('appointments.tomorrow, 15:00')).toBeInTheDocument();
  });
});

describe("the owner's booking: the hour chips (LT-702)", () => {
  const times = (phone: string, onPickTime = vi.fn()) => {
    inStore(
      phone,
      <DayTimes
        mode="times"
        day={new Date(2026, 11, 2)}
        slots={['09:00', '12:00', '15:00']}
        loading={false}
        time=""
        onPickTime={onPickTime}
        timeZone="America/New_York"
        sessions={[]}
        sessionTs=""
        onPickSession={vi.fn()}
        failed={false}
      />,
    );
    return within(screen.getByRole('group'));
  };

  it('an American business: labelled "3:00 PM", and "15:00" is what is picked', () => {
    const onPickTime = vi.fn();
    const group = times(US, onPickTime);
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['9:00 AM', '12:00 PM', '3:00 PM']);
    fireEvent.click(group.getByRole('button', { name: '3:00 PM' }));
    expect(onPickTime).toHaveBeenCalledWith('15:00');
  });

  it('an Israeli business: as before', () => {
    const onPickTime = vi.fn();
    const group = times(IL, onPickTime);
    expect(group.getAllByRole('button').map((b) => b.textContent)).toEqual(['09:00', '12:00', '15:00']);
    fireEvent.click(group.getByRole('button', { name: '15:00' }));
    expect(onPickTime).toHaveBeenCalledWith('15:00');
  });
});
