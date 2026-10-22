import { useEffect, useState } from 'react';

/**
 * LT-438: true for the first one of these to show in this session, and for
 * its whole life; every later one shows already drawn. The home page's
 * graphs drew themselves in on every visit, the heaviest moment in the
 * dashboard (LT-437). Several mounting together (three sparklines) all get
 * the first time.
 */
const shown = new Set<string>();

export function useFirstTime(key: string): boolean {
  const [first] = useState(() => !shown.has(key));
  useEffect(() => { shown.add(key); }, [key]);
  return first;
}

/** Tests start each case as a new session. */
export const resetFirstTimes = () => shown.clear();
