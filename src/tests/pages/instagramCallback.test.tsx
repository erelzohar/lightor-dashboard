import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import InstagramCallback from '../../pages/InstagramCallback';
import { stubLocation, restoreLocation } from '../helpers/location';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/**
 * The Instagram Login popup landing (LT-043).
 *
 * The page relays ?code and ?state to the opener and closes. The two things
 * that must never regress: the postMessage target origin is pinned to our own
 * origin (never '*' — LT-008), and a missing opener doesn't crash the page.
 */
describe('InstagramCallback', () => {
  const setOpener = (value: { postMessage: ReturnType<typeof vi.fn> } | null) =>
    Object.defineProperty(window, 'opener', { configurable: true, value });

  afterEach(() => {
    restoreLocation();
    setOpener(null);
  });

  it('relays code and state to the opener at our own origin, then closes', () => {
    stubLocation('https://dashboard.lightor.app/instagram-callback?code=igc_1&state=st_1');
    const postMessage = vi.fn();
    setOpener({ postMessage });
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});

    render(<InstagramCallback />);

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'ig-oauth', code: 'igc_1', state: 'st_1', error: undefined },
      'https://dashboard.lightor.app'
    );
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });

  it('relays a refusal and survives having no opener', () => {
    stubLocation('https://dashboard.lightor.app/instagram-callback?error=access_denied&state=st_2');
    setOpener(null);
    const close = vi.spyOn(window, 'close').mockImplementation(() => {});

    expect(() => render(<InstagramCallback />)).not.toThrow();
    expect(close).toHaveBeenCalled();
    close.mockRestore();
  });
});
