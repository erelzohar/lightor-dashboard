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
 */
export function useClassSessions(fromMs: number, toMs: number): Session[] {
  const dispatch = useAppDispatch();
  const types = useAppSelector((state) => state.appointments.appointmentTypes);
  const webConfigId = useAppSelector((state) => state.webConfig.data?._id);
  const subDomain = useAppSelector((state) => state.webConfig.data?.subDomain);
  const teachesClasses = types.some((type) => type.kind === 'class');
  const [fetched, setFetched] = useState<{ key: string; sessions: ClassSessionAvailability[] } | null>(null);

  // The services, if nothing has fetched them yet: a class is known by its service.
  useEffect(() => {
    if (!types.length && webConfigId) dispatch(fetchAppointmentTypes({ webConfig_id: webConfigId }));
  }, [types.length, webConfigId, dispatch]);

  const key = `${fromMs}|${toMs}`;
  useEffect(() => {
    if (!teachesClasses || !subDomain) return;
    let cancelled = false;
    getClassSessions(subDomain, String(fromMs), String(toMs))
      .then((sessions) => {
        if (!cancelled) setFetched({ key, sessions });
      })
      // Unread, the page is what it was before LT-211: the booked sessions only.
      .catch(() => {
        if (!cancelled) setFetched({ key, sessions: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [teachesClasses, subDomain, fromMs, toMs, key]);

  return useMemo(
    () => (teachesClasses && fetched?.key === key ? listedSessions(fetched.sessions, types) : []),
    [teachesClasses, fetched, key, types]
  );
}
