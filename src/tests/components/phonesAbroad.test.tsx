import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import PhonesAbroad from '../../components/app/PhonesAbroad';
import apiClient from '../../services/apiClient';
import globals from '../../services/globals';
import { closeCodeFrame, sendFrameCode } from '../../services/codeFrame';
import { getPhoneCountries, resetPhoneCountries } from '../../services/phoneCountries';
import { frameRoot } from '../helpers/codeFrame';

/**
 * LT-677: the app-wide piece behind phones abroad. Signed in, it asks the
 * API for the open countries once; it keeps the country of the owner's phone
 * and the words of the code frame's panel current; it draws nothing.
 */
const { auth } = vi.hoisted(() => ({ auth: { user: null as { phone?: string } | null } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ auth }) }));

let get: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  auth.user = null;
  get = vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { success: true, data: { home: 'IL', abroad: ['US'] } } } as never);
});

afterEach(() => {
  closeCodeFrame();
  resetPhoneCountries();
  vi.restoreAllMocks();
});

describe('PhonesAbroad (LT-677)', () => {
  it('asks nothing while nobody is signed in, and draws nothing', () => {
    const { container } = render(<PhonesAbroad />);
    expect(container).toBeEmptyDOMElement();
    expect(get).not.toHaveBeenCalled();
    expect(getPhoneCountries().abroad).toEqual([]);
  });

  it('asks for the open countries once someone is signed in, and only once', async () => {
    auth.user = { phone: '+972501234567' };
    const { rerender } = render(<PhonesAbroad />);
    await waitFor(() => expect(getPhoneCountries().abroad).toEqual(['US']));
    auth.user = { phone: '+972501234567' };
    rerender(<PhonesAbroad />);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(`${globals.messagingUrl}phone-countries`);
  });

  it('stays on Israel alone when the API has no such route', async () => {
    get.mockRejectedValue({ response: { status: 404 } });
    auth.user = { phone: '+972501234567' };
    render(<PhonesAbroad />);
    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));
    expect(getPhoneCountries().abroad).toEqual([]);
  });

  it("follows the country of the owner's phone", () => {
    auth.user = { phone: '+12125550123' };
    const { rerender } = render(<PhonesAbroad />);
    expect(getPhoneCountries().ownerCountry).toBe('US');
    auth.user = { phone: '050-1234567' };
    rerender(<PhonesAbroad />);
    expect(getPhoneCountries().ownerCountry).toBe('IL');
    auth.user = null;
    rerender(<PhonesAbroad />);
    expect(getPhoneCountries().ownerCountry).toBe('IL');
  });

  it("names the code frame's panel in the owner's language", () => {
    render(<PhonesAbroad />);
    sendFrameCode('+12125550123', 'en').catch(() => {});
    expect(frameRoot()).toHaveTextContent('phoneInput.checkTitle');
    expect(frameRoot()!.querySelector('iframe')).toHaveAttribute('title', 'phoneInput.checkTitle');
    expect(frameRoot()!.querySelector('button')).toHaveAttribute('aria-label', 'phoneInput.checkClose');
  });
});
