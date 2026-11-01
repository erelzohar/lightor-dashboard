import { useEffect, useState } from 'react';
import { fetchUnreadNotifications } from '../services/notificationsApi';

/**
 * How many notifications wait unread (LT-527), for the sidebar's badge and
 * the dot on "More". One shared value, like useNewLeadsCount: the page clears
 * it as soon as it has shown them.
 */
let current: number | null = null;
const listeners = new Set<(n: number | null) => void>();

export const setUnreadNotifications = (n: number | null): void => {
  current = n;
  listeners.forEach((fn) => fn(n));
};

/** Re-read the count from the API; a failure leaves the last value. */
export const refreshUnreadNotifications = async (): Promise<void> => {
  try {
    setUnreadNotifications(await fetchUnreadNotifications());
  } catch {
    /* the badge is decoration */
  }
};

export const useUnreadNotifications = (): number | null => {
  const [count, setCount] = useState<number | null>(current);
  useEffect(() => {
    listeners.add(setCount);
    return () => {
      listeners.delete(setCount);
    };
  }, []);
  return count;
};
