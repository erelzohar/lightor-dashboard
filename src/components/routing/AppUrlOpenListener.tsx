import { useAppUrlOpen } from '../../hooks/useAppUrlOpen';

/**
 * Native deep links for every route, signed in or not (LT-315): mounted once
 * at the app root, inside the router. Renders nothing; a no-op on the web.
 */
const AppUrlOpenListener = (): null => {
  useAppUrlOpen();
  return null;
};

export default AppUrlOpenListener;
