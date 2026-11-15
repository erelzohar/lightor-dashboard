import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkDomain,
  connectDomain,
  disconnectDomain,
  domainErrorStatus,
  fetchDomain,
  type DomainAnswer,
} from '../services/domainApi';

/**
 * LT-661 (phase 2): the owner's own domain, as the Settings page holds it.
 * One read when the page opens, then every action's answer is the new state
 * (each route answers the same shape). The page keeps it, so leaving the
 * Site tab and coming back shows the same thing with no second read.
 */

export type DomainAction = 'connect' | 'check' | 'disconnect';

export interface OwnDomain {
  /** Null until the first read is in (or when it failed). */
  answer: DomainAnswer | null;
  loading: boolean;
  /** The read failed, and not because this server has no such route yet. */
  failed: boolean;
  /** The action the owner pressed and is waiting for; the quiet check never shows here. */
  busy: DomainAction | null;
  reload: () => Promise<void>;
  /** Throws the server's refusal, for the form to put in words. */
  connect: (host: string) => Promise<DomainAnswer>;
  /**
   * Asks the server to look again. `quiet` is the timer's check: no busy
   * state, no error, and it steps aside for anything the owner pressed.
   * Null when it did not run or (quiet) failed.
   */
  check: (options?: { quiet?: boolean }) => Promise<DomainAnswer | null>;
  disconnect: () => Promise<DomainAnswer>;
}

/** A server from before the feature: the row stays "coming soon". */
const NOT_CONFIGURED: DomainAnswer = { configured: false, allowed: false, target: '', domain: null };

/** The host the site is served on right now: connected, live, and on a plan that has it. */
export const servedHostOf = (answer: DomainAnswer | null): string | null =>
  answer?.configured && answer.allowed && answer.domain?.status === 'active' ? answer.domain.host : null;

interface Options {
  /**
   * An action (never the first read) changed the host the site is served on:
   * the page reads the site's config again, so every link follows.
   */
  onServedChange?: (host: string | null) => void;
}

export const useOwnDomain = ({ onServedChange }: Options = {}): OwnDomain => {
  const [answer, setAnswer] = useState<DomainAnswer | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<DomainAction | null>(null);

  const live = useRef(true);
  const current = useRef<DomainAnswer | null>(null);
  // The timer's check steps aside for what the owner pressed: it does not
  // start while a request is out, and its answer is dropped when the owner
  // acted meanwhile (a late "pending" must not bring back a domain that was
  // just disconnected).
  const inFlight = useRef(0);
  const actions = useRef(0);
  const servedChanged = useRef(onServedChange);
  servedChanged.current = onServedChange;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const adopt = useCallback((next: DomainAnswer, byAction: boolean) => {
    const before = servedHostOf(current.current);
    current.current = next;
    if (!live.current) return;
    setAnswer(next);
    const after = servedHostOf(next);
    if (byAction && before !== after) servedChanged.current?.(after);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      adopt(await fetchDomain(), false);
    } catch (error) {
      if (!live.current) return;
      // An API from before the feature has no such route: not an error to show.
      if (domainErrorStatus(error) === 404) adopt(NOT_CONFIGURED, false);
      else setFailed(true);
    } finally {
      if (live.current) setLoading(false);
    }
  }, [adopt]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const act = useCallback(
    async (action: DomainAction, call: () => Promise<DomainAnswer>): Promise<DomainAnswer> => {
      inFlight.current += 1;
      actions.current += 1;
      setBusy(action);
      try {
        const next = await call();
        adopt(next, true);
        return next;
      } finally {
        inFlight.current -= 1;
        if (live.current) setBusy(null);
      }
    },
    [adopt]
  );

  const connect = useCallback((host: string) => act('connect', () => connectDomain(host)), [act]);
  const disconnect = useCallback(() => act('disconnect', disconnectDomain), [act]);

  const check = useCallback(
    async ({ quiet = false }: { quiet?: boolean } = {}): Promise<DomainAnswer | null> => {
      if (!quiet) return act('check', checkDomain);
      if (inFlight.current > 0) return null;
      inFlight.current += 1;
      const before = actions.current;
      try {
        const next = await checkDomain();
        if (actions.current !== before) return null;
        adopt(next, true);
        return next;
      } catch {
        // The next round asks again.
        return null;
      } finally {
        inFlight.current -= 1;
      }
    },
    [act, adopt]
  );

  return { answer, loading, failed, busy, reload, connect, check, disconnect };
};
