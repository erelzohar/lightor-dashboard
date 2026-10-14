import { lazy, type ComponentType } from 'react';

/**
 * React.lazy that falls back instead of throwing when its chunk cannot load
 * (LT-315). A deploy replaces every hashed chunk, so a tab opened before it
 * asks for one that is gone; a flaky phone connection does the same. A bare
 * lazy() rejects into the nearest error boundary — here the route's, which
 * took the whole dashboard down over a decorative 3D Lighty.
 */
export const lazyOr = <P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>,
  Fallback: ComponentType<P>
) => lazy(() => load().catch(() => ({ default: Fallback })));
