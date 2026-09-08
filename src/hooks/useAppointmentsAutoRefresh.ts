import { useEffect } from 'react';
import { useAppDispatch } from './useAppDispatch';
import { fetchAppointments } from '../store/slices/appointmentsSlice';

/**
 * Fetch the owner's appointments on mount and every `intervalMs` afterwards.
 * (LT-144)
 *
 * Replaces a block copy-pasted onto Dashboard and Appointments whose interval
 * closed over a stale `appointments` — it was never in the effect's deps, so
 * the guard `if (appointments.length)` was captured empty at mount and the
 * 4-minute refresh never fired once data loaded. The old effect also listed
 * the whole `auth` object as a dep, so every `setAuth` (e.g. the billing
 * poll) tore the interval down and reset its timer. Keying on the stable user
 * id and dropping the guard makes the periodic refresh actually run.
 */
export function useAppointmentsAutoRefresh(userId?: string, intervalMs = 240_000): void {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!userId) return;
    dispatch(fetchAppointments({ user_id: userId, limit: 5000 }));
    const interval = setInterval(() => {
      dispatch(fetchAppointments({ user_id: userId, limit: 5000 }));
    }, intervalMs);
    return () => clearInterval(interval);
  }, [dispatch, userId, intervalMs]);
}
