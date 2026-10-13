/**
 * When the plans may be offered (LT-290, Erel 2026-10-13). The 60 free days of
 * Plus are the system's own: no card, no subscription, nothing to buy on
 * screen. A week before they end the server's `pilot.upgradeFrom` arrives,
 * the owner is reminded, and the plans open; whoever subscribes then is first
 * charged when the 60 days end.
 *
 * No grant at all (a paid account, a lapsed grant, the grant off) means the
 * usual rules apply, so the window is open; a grant without `upgradeFrom`
 * (an API older than this build) keeps it closed.
 */
export const upgradeIsOpen = (
  pilot: { until: string; upgradeFrom?: string | null } | null | undefined,
  now: number = Date.now()
): boolean => !pilot || (!!pilot.upgradeFrom && now >= Date.parse(pilot.upgradeFrom));
