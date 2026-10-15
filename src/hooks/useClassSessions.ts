import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from './useAppDispatch';
import { useAppSelector } from './useAppSelector';
import { fetchAppointmentTypes } from '../store/slices/appointmentsSlice';
import { getClassSessions, type ClassSessionAvailability } from '../services/appointmentsApi';
import { Session, listedSessions } from '../utils/sessions';

/**
 * The class sessions the server lists for a window (LT-211), as sessions with
 * no one in them yet — for the calendar and the list to show a class nobody
 * has booked into, and to open its roster. The bookings of the sessions that
 * have some are the store's; `withListedSessions` puts the two together.
 *
 * Asks only when the business teaches a class at all (most never do), and
 * again when the window moves. Signed in as the owner, the server lists
 * sessions from a day back and past the customers' booking window.
 *
 * A window read once is kept for the visit (LT-358): coming back to the list,
 * or to a week already seen, shows its classes at once while they are read
 * again. `pending` says they are still on their way the first time (the
 * business, its services or the sessions), so a page can wait for them
 * instead of drawing the bookings first and the classes a moment later.
 */
const readWindows = new Map<string, ClassSessionAvailability[]>();
const KEPT_WINDOWS = 40;

const keep = (key: string, sessions: ClassSessionAvailability[]) => {
  readWindows.delete(key);
  readWindows.set(key, sessions);
  if (readWindows.size > KEPT_WINDOWS) readWindows.delete(readWindows.keys().next().value as string);
};

/** Tests start from nothing read. */
export const forgetClassSessions = (): void => readWindows.clear();

export function useClassSessionsState(fromMs: number, toMs: number): { sessions: Session[]; pending: boolean } {
  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.appointments.appointmentTypes);
  const typesLoading = useAppSelector((state) => state.appointments.typesLoading);
  const webConfigId = useAppSelector((state) => state.webConfig.data?._id);
  const subDomain = useAppSelector((state) => state.webConfig.data?.subDomain);
  const webConfigLoading = useAppSelector((state) => state.webConfig.loading);
  const teachesClasses = types.some((type) => type.kind === 'class');
  const [fetched, setFetched] = useState<{ key: string; sessions: ClassSessionAvailability[] } | null>(null);

  // The services, if nothing has fetched them yet: a class is known by its service.
  useEffect(() => {
    if (!types.length && webConfigId) dispatch(fetchAppointmentTypes({ webConfig_id: webConfigId }));
  }, [types.length, webConfigId, dispatch]);

  const key = `${subDomain}|${fromMs}|${toMs}`;
  useEffect(() => {
    if (!teachesClasses || !subDomain) return;
    let cancelled = false;
    getClassSessions(subDomain, String(fromMs), String(toMs))
      .then((sessions) => {
        keep(key, sessions);
        if (!cancelled) setFetched({ key, sessions });
      })
      // Unread, the page is what it was before LT-211: the booked sessions only.
      .catch(() => {
        if (!cancelled) setFetched({ key, sessions: readWindows.get(key) ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, [teachesClasses, subDomain, fromMs, toMs, key]);

  const known = fetched?.key === key ? fetched.sessions : readWindows.get(key);
  const sessions = useMemo(
    () => (teachesClasses && known ? listedSessions(known, types) : []),
    [teachesClasses, known, types]
  );
  const pending =
    (!subDomain && !!webConfigLoading) || !!typesLoading || (teachesClasses && !!subDomain && known === undefined);
  return { sessions, pending };
}

export function useClassSessions(fromMs: number, toMs: number): Session[] {
  return useClassSessionsState(fromMs, toMs).sessions;
}
