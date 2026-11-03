import { useEffect, useMemo, useState } from 'react';
import { useAppSelector } from './useAppSelector';
import { useAppDispatch } from './useAppDispatch';
import { useAuth } from '../contexts/AuthContext';
import { fetchLeadStats } from '../services/leadsApi';
import { fetchAppointments } from '../store/slices/appointmentsSlice';
import { isLeadsSite } from '../utils/siteMode';
import { lightySuggestions, type Suggestion } from '../utils/lightySuggestions';

const NONE: never[] = [];

/**
 * LT-566: Lighty's ready questions for this business now. The new leads are
 * asked for each time the questions show; a booking site's appointments are
 * read once when no page has read them yet. `enabled` false (the floating
 * card closed) asks for nothing.
 */
export function useLightySuggestions(enabled = true): Suggestion[] {
  const webConfig = useAppSelector((s) => s.webConfig.data);
  const appointments = useAppSelector((s) => s.appointments?.appointments) ?? NONE;
  const appointmentsLoaded = useAppSelector((s) => s.appointments?.loaded) ?? false;
  const appointmentsLoading = useAppSelector((s) => s.appointments?.loading) ?? false;
  const storedVacations = useAppSelector((s) => s.vacations?.data) ?? NONE;
  const dispatch = useAppDispatch();
  const { auth } = useAuth();
  const userId = auth.user?._id;
  const leadsSite = isLeadsSite(webConfig);
  const [waitingLeads, setWaitingLeads] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    fetchLeadStats()
      .then((s) => { if (live) setWaitingLeads(typeof s?.waiting === 'number' ? s.waiting : null); })
      .catch(() => undefined);
    return () => { live = false; };
  }, [enabled]);

  useEffect(() => {
    if (enabled && !leadsSite && userId && !appointmentsLoaded && !appointmentsLoading) {
      void dispatch(fetchAppointments({ user_id: userId, limit: 5000 }));
    }
  // Once per opening: a failed read is not retried in a loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, leadsSite, userId]);

  return useMemo(() => lightySuggestions({
    conversion: webConfig?.conversion,
    timeZone: webConfig?.timeZone,
    workingDays: webConfig?.workingDays,
    dateOverrides: webConfig?.dateOverrides,
    vacations: [...(webConfig?.vacations ?? []), ...storedVacations],
    appointments,
    appointmentsLoaded,
    waitingLeads,
    catalog: webConfig?.catalog,
    productsTotal: webConfig?.products?.total,
  }), [webConfig, storedVacations, appointments, appointmentsLoaded, waitingLeads]);
}
