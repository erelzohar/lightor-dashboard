import { useCallback, useEffect, useMemo, useState } from 'react';
import { Appointment } from '../types';
import { Session, findSession } from '../utils/sessions';

/**
 * Which session's roster is open, followed through the store (LT-204).
 *
 * The host keeps the session's id, never a copy of it: the roster is rebuilt
 * from `appointments` on every render, so a walk-in seated from it (or anyone
 * cancelled in it) shows as soon as the list is fetched again. A session that
 * leaves the list closes its roster for good, rather than springing it open
 * again should someone later book that same time.
 */
export function useOpenSession(appointments: Appointment[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openSession = useMemo(() => findSession(appointments, openId), [appointments, openId]);

  useEffect(() => {
    if (openId && !openSession) setOpenId(null);
  }, [openId, openSession]);

  const openRoster = useCallback((session: Session) => setOpenId(session.id), []);
  const closeRoster = useCallback(() => setOpenId(null), []);

  return { openSession, openRoster, closeRoster };
}
