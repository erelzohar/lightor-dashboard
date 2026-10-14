import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import Appointments from '../../pages/Appointments';
import appointmentsReducer from '../../store/slices/appointmentsSlice';
import webConfigReducer from '../../store/slices/webConfigSlice';
import { getAppointments } from '../../services/appointmentsApi';
import type { Appointment } from '../../types';

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

const renderPage = () => {
  const store = configureStore({ reducer: combineReducers({ appointments: appointmentsReducer, webConfig: webConfigReducer }) });
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/appointments']}>
        <Appointments />
      </MemoryRouter>
    </Provider>
  );
};

/** LT-331 — the list said "no appointments" while it was still loading them. */
describe('the appointments list, loading', () => {
  beforeEach(() => {
    localStorage.setItem('appointments_view_mode', 'list');
  });

  it('shows a loader, not "no appointments", before the book is read (the account still loading)', () => {
    const user = authValue.auth.user;
    (authValue.auth as { user: unknown }).user = null; // auth/me not back yet: nothing fetches
    try {
      renderPage();
      expect(screen.getByTestId('appointments-loading')).toBeInTheDocument();
      expect(screen.queryByText('appointments.noAppointments')).toBeNull();
    } finally {
      (authValue.auth as { user: unknown }).user = user;
    }
  });

  it('says there are none only once the book is read and empty', async () => {
    let finish: (rows: Appointment[]) => void = () => {};
    vi.mocked(getAppointments).mockReturnValue(new Promise<Appointment[]>((res) => { finish = res; }));
    renderPage();
    expect(screen.queryByText('appointments.noAppointments')).toBeNull();
    await act(async () => { finish([]); });
    expect(await screen.findByText('appointments.noAppointments')).toBeInTheDocument();
    expect(screen.queryByTestId('appointments-loading')).toBeNull();
  });
});
