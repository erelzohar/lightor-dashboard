import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import HiddenHistoryNotice from '../../components/account/HiddenHistoryNotice';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/** LT-521: older history waits behind the plan, and the owner is told how much. */
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));
vi.mock('../../lib/platform', () => ({ canOfferPurchases: vi.fn(() => true) }));

const hidden = (bookings: number, leads: number) =>
  vi.mocked(fetchMyEntitlements).mockResolvedValue({ hiddenHistory: { bookings, leads } } as unknown as MyEntitlements);
const show = (kind: 'bookings' | 'leads') => render(<MemoryRouter><HiddenHistoryNotice kind={kind} /></MemoryRouter>);

describe('HiddenHistoryNotice', () => {
  beforeEach(() => {
    vi.mocked(canOfferPurchases).mockReturnValue(true);
  });

  it('says what is hidden and links to the plans on the web', async () => {
    hidden(143, 0);
    show('bookings');
    expect(await screen.findByTestId('hidden-history')).toHaveTextContent('billing.hiddenHistory.bookings');
    expect(screen.getByRole('link', { name: 'billing.hiddenHistory.upgrade' })).toHaveAttribute('href', '/account');
  });

  it('counts the page`s own kind', async () => {
    hidden(143, 0);
    show('leads');
    await vi.waitFor(() => expect(fetchMyEntitlements).toHaveBeenCalled());
    expect(screen.queryByTestId('hidden-history')).toBeNull();
  });

  it('states the fact alone in the app', async () => {
    vi.mocked(canOfferPurchases).mockReturnValue(false);
    hidden(0, 12);
    show('leads');
    expect(await screen.findByTestId('hidden-history')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
