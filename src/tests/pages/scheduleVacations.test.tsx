import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduleVacations from '../../pages/ScheduleVacations';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { createVacation } from '../../store/slices/vacationsSlice';

const { t } = vi.hoisted(() => ({
  t: (key: string, opts?: { returnObjects?: boolean }) =>
    opts?.returnObjects ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] : key,
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: toastMock }));
vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({ direction: 'ltr', language: 'en', darkMode: false }),
}));
// Stable: the page's load effect depends on `auth`.
const authValue = vi.hoisted(() => ({ auth: { user: { _id: 'u1', webConfig_id: 'wc1' } } }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authValue }));
vi.mock('../../store/slices/vacationsSlice', () => ({
  createVacation: vi.fn((vacation: unknown) => ({ type: 'vacations/create', payload: vacation })),
  updateVacation: vi.fn(),
  deleteVacation: vi.fn(),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
  fetchWebConfig: vi.fn(() => ({ type: 'webConfig/fetch' })),
  updateWebConfig: Object.assign(
    vi.fn((payload: unknown) => ({ type: 'webConfig/update', payload })),
    { rejected: { match: (action: { type?: string }) => action?.type === 'webConfig/update/rejected' } }
  ),
}));
const state = vi.hoisted(() => ({
  webConfig: { data: null as unknown, loading: false, error: null as string | null },
}));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: typeof state) => unknown): unknown => selector(state),
}));
const dispatchMock = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatchMock }));

const config = (conversion?: 'book' | 'lead') => ({
  _id: 'wc1',
  conversion,
  workingDays: [null, null, null, null, null, null, null] as (string | null)[],
  dateOverrides: [{ date: '2099-01-01', hours: null as string | null }],
  vacations: [] as unknown[],
});

const openSunday = () => fireEvent.click(screen.getAllByRole('switch')[0]);

beforeEach(() => {
  toastMock.success.mockReset();
  toastMock.error.mockReset();
  vi.mocked(updateWebConfig).mockClear();
  dispatchMock.mockReset().mockImplementation((action: { type: string }) =>
    Promise.resolve(action.type === 'webConfig/update' ? { type: 'webConfig/update/fulfilled', payload: {} } : action)
  );
  state.webConfig.data = config();
});

/**
 * G6 (LT-199): a bare dispatch resolves when the server refuses too, and the
 * page said "saved" and took the draft as its new baseline.
 */
describe('Schedule: saving the hours', () => {
  it('says so, and keeps the change pending, when the save is refused', async () => {
    dispatchMock.mockImplementation((action: { type: string }) =>
      Promise.resolve(action.type === 'webConfig/update' ? { type: 'webConfig/update/rejected', error: { message: '400' } } : action)
    );
    render(<ScheduleVacations />);

    openSunday();
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('scheduleVacations.saveError'));
    expect(toastMock.success).not.toHaveBeenCalled();
    // Still unsaved: the bar offers the save again.
    expect(screen.getByText('common.save')).toBeInTheDocument();
  });

  it('says saved when the server stored it', async () => {
    render(<ScheduleVacations />);

    openSunday();
    fireEvent.click(await screen.findByText('common.save'));

    await waitFor(() => expect(toastMock.success).toHaveBeenCalledWith('scheduleVacations.saveSuccess'));
    expect(toastMock.error).not.toHaveBeenCalled();
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0];
    expect(payload.workingDays?.[0]).toBe('09:00-17:00');
    expect(payload.dateOverrides).toEqual([{ date: '2099-01-01', hours: null }]);
  });
});

/**
 * A leads site's hours (LT-199) are only what the site shows: "Opening
 * hours", the weekly hours alone — no special dates, no vacations.
 */
describe('Schedule by site mode', () => {
  it('keeps special dates and vacations on a booking site', () => {
    render(<ScheduleVacations />);

    expect(screen.getByText('scheduleVacations.title')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.specialHours')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.vacationManagement')).toBeInTheDocument();
  });

  it('is the weekly opening hours alone on a leads site, and saves only them', async () => {
    state.webConfig.data = config('lead');
    render(<ScheduleVacations />);

    expect(screen.getByText('scheduleVacations.openingHoursTitle')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.openingHoursDesc')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.workingHours')).toBeInTheDocument();
    expect(screen.queryByText('scheduleVacations.title')).not.toBeInTheDocument();
    expect(screen.queryByText('scheduleVacations.specialHours')).not.toBeInTheDocument();
    expect(screen.queryByText('scheduleVacations.vacationManagement')).not.toBeInTheDocument();

    openSunday();
    fireEvent.click(await screen.findByText('common.save'));
    await waitFor(() => expect(updateWebConfig).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(updateWebConfig).mock.calls[0][0];
    expect(payload.workingDays?.[0]).toBe('09:00-17:00');
    // The stored special dates are left alone, not sent back.
    expect(payload).not.toHaveProperty('dateOverrides');
  });
});

/** The same defect on the vacations (as G6): a refused add said "added". */
describe('Schedule: adding a vacation', () => {
  it('says the add failed and lists nothing when the server refuses it', async () => {
    // As RTK's dispatch answers a thunk: a promise that also unwraps.
    dispatchMock.mockImplementation((action: { type: string }) =>
      action.type === 'vacations/create'
        ? Object.assign(Promise.resolve({ type: 'vacations/create/rejected' }), {
            unwrap: () => Promise.reject(new Error('Request failed with status code 400')),
          })
        : Promise.resolve(action)
    );
    render(<ScheduleVacations />);

    fireEvent.click(screen.getByText('scheduleVacations.noVacations').closest('div.glass-panel')!.querySelector('button')!);
    fireEvent.change(screen.getByPlaceholderText('scheduleVacations.vacationPlaceholder'), { target: { value: 'Summer' } });
    fireEvent.click(screen.getByText('common.add'));

    await waitFor(() => expect(toastMock.error).toHaveBeenCalledWith('scheduleVacations.addError'));
    expect(createVacation).toHaveBeenCalledTimes(1);
    expect(vi.mocked(createVacation).mock.calls[0][0]).toMatchObject({ title: 'Summer', webConfig_id: 'wc1' });
    expect(toastMock.success).not.toHaveBeenCalled();
    expect(screen.queryByText('Summer')).not.toBeInTheDocument();
  });
});
