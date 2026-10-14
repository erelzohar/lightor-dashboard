import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ScheduleVacations from '../../pages/ScheduleVacations';
import { updateWebConfig } from '../../store/slices/webConfigSlice';
import { createVacation, updateVacation } from '../../store/slices/vacationsSlice';
import { zonedTimeToMs } from '../../utils/businessTime';
import { vacationDays, vacationInputValue, vacationMs } from '../../utils/vacationTime';

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
  updateVacation: vi.fn((vacation: unknown) => ({ type: 'vacations/update', payload: vacation })),
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

/**
 * LT-318: a vacation is typed, stored and shown on the BUSINESS's clock. A
 * `datetime-local` value read as the device's wall clock stored a New York
 * business's 10:00 as some other hour on a phone set elsewhere (the suite
 * runs under TZ=UTC and TZ=Asia/Dubai too).
 */
describe("Schedule: a vacation on the business's clock", () => {
  const NY = 'America/New_York';
  const J = 'Asia/Jerusalem';
  // As RTK's dispatch answers a thunk: a promise that also unwraps.
  const thunkAnswers = () =>
    dispatchMock.mockImplementation((action: { type: string; payload?: unknown }) =>
      Object.assign(Promise.resolve(action), { unwrap: () => Promise.resolve(action.payload) })
    );
  const dateTimeInputs = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]'));
  beforeEach(() => {
    vi.mocked(createVacation).mockClear();
    vi.mocked(updateVacation).mockClear();
  });

  it("stores what the owner types as the business's wall clock", async () => {
    state.webConfig.data = { ...config(), timeZone: NY };
    thunkAnswers();
    const { container } = render(<ScheduleVacations />);

    fireEvent.click(screen.getByText('scheduleVacations.noVacations').closest('div.glass-panel')!.querySelector('button')!);
    fireEvent.change(screen.getByPlaceholderText('scheduleVacations.vacationPlaceholder'), { target: { value: 'Spring' } });
    const [start, end] = dateTimeInputs(container);
    fireEvent.change(start, { target: { value: '2030-03-04T10:00' } });
    fireEvent.change(end, { target: { value: '2030-03-10T18:00' } });
    fireEvent.click(screen.getByText('common.add'));

    await waitFor(() => expect(createVacation).toHaveBeenCalledTimes(1));
    expect(vi.mocked(createVacation).mock.calls[0][0]).toMatchObject({
      title: 'Spring',
      startDate: String(Date.UTC(2030, 2, 4, 15, 0)),
      // New York's clocks go forward on 10 March 2030: 18:00 is an hour nearer UTC.
      endDate: String(Date.UTC(2030, 2, 10, 22, 0)),
    });
  });

  it("shows a stored vacation on the business's clock and edits it there", async () => {
    const vacation = {
      _id: 'v1',
      title: 'Away',
      startDate: String(Date.UTC(2030, 2, 4, 15, 0)),
      endDate: String(Date.UTC(2030, 2, 6, 15, 0)),
      webConfig_id: 'wc1',
    };
    state.webConfig.data = { ...config(), timeZone: NY, vacations: [vacation] };
    thunkAnswers();
    const { container } = render(<ScheduleVacations />);

    expect(screen.getByText('scheduleVacations.fromMarch 4th, 2030 - 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText('scheduleVacations.toMarch 6th, 2030 - 10:00 AM')).toBeInTheDocument();
    expect(screen.getByText(/^2 scheduleVacations\.days/)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('common.edit'));
    const [start, end] = dateTimeInputs(container);
    expect(start.value).toBe('2030-03-04T10:00');
    expect(end.value).toBe('2030-03-06T10:00');
    fireEvent.change(end, { target: { value: '2030-03-06T12:30' } });
    const saves = screen.getAllByText('common.save');
    fireEvent.click(saves[saves.length - 1]);

    await waitFor(() => expect(updateVacation).toHaveBeenCalledTimes(1));
    expect(vi.mocked(updateVacation).mock.calls[0][0]).toMatchObject({
      _id: 'v1',
      startDate: vacation.startDate,
      endDate: String(Date.UTC(2030, 2, 6, 17, 30)),
    });
    // The list reads the stored instant back on the same clock.
    expect(await screen.findByText('scheduleVacations.toMarch 6th, 2030 - 12:30 PM')).toBeInTheDocument();
  });

  it('round-trips through the helpers in any zone, and counts calendar days across a clock change', () => {
    for (const tz of [J, NY, 'Asia/Dubai', 'Pacific/Auckland']) {
      for (const value of ['2026-10-25T09:00', '2027-03-26T23:30']) {
        const ms = vacationMs(value, tz);
        expect(vacationInputValue(String(ms), tz)).toBe(value);
        expect(vacationMs(String(ms), tz)).toBe(ms);
      }
    }
    expect(vacationMs('2026-10-25T09:00', J)).toBe(Date.UTC(2026, 9, 25, 7, 0));
    // Saturday to Tuesday over Israel's 25.10.2026 change: three days, not 73 hours' four.
    const from = zonedTimeToMs(2026, 9, 24, 0, 0, J);
    const to = zonedTimeToMs(2026, 9, 27, 0, 0, J);
    expect(to - from).toBe(73 * 3_600_000);
    expect(vacationDays(from, to, J)).toBe(3);
    expect(vacationMs('', J)).toBeNaN();
    expect(vacationInputValue('', J)).toBe('');
    expect(vacationDays(NaN, to, J)).toBe(0);
  });
});
