import { useEffect, useState } from 'react';
import { fetchLeads } from '../services/leadsApi';

/**
 * How many leads are still `new` (LT-197), for the sidebar badge and the home
 * card. One shared value: the Leads page pushes the fresh count after every
 * change, so the badge never lags behind the page the owner is looking at.
 */
let current: number | null = null;
const listeners = new Set<(n: number | null) => void>();

export const setNewLeadsCount = (n: number | null): void => {
  current = n;
  listeners.forEach((fn) => fn(n));
};

/** Re-read the count from the API; a failure leaves the last value. */
export const refreshNewLeadsCount = async (): Promise<void> => {
  try {
    const page = await fetchLeads({ limit: 1 });
    setNewLeadsCount(page.counts?.new ?? 0);
  } catch {
    /* the badge is decoration */
  }
};

export const useNewLeadsCount = (enabled = true): number | null => {
  const [count, setCount] = useState<number | null>(current);
  useEffect(() => {
    listeners.add(setCount);
    if (enabled) void refreshNewLeadsCount();
    return () => {
      listeners.delete(setCount);
    };
  }, [enabled]);
  return count;
};
