import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import webConfigReducer from '../../store/slices/webConfigSlice';
import Customers from '../../pages/Customers';
import BillingSection from '../../components/account/BillingSection';
import { fetchCustomers, fetchCustomerStats } from '../../services/customersApi';
import { fetchMyEntitlements } from '../../services/entitlementsApi';

/**
 * LT-702: a customer's last visit and the Account page's next bill, written
 * month first for an American business, as before for an Israeli one.
 */
const { t } = vi.hoisted(() => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr', darkMode: false, language: 'en' }) }));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    auth: {
      user: {
        _id: 'u1',
        webConfig_id: 'wc1',
        email: 'owner@biz.co',
        subscription: { status: 'active', plan: 'plus', subscriptionId: 'sub_1', nextBillDate: '2026-12-01T12:00:00Z' },
      },
    },
    refreshUser: vi.fn(),
  }),
}));
vi.mock('../../hooks/useAppSelector', () => ({ useAppSelector: (): unknown[] => [] }));
vi.mock('../../hooks/useAppDispatch', () => ({ useAppDispatch: (): (() => void) => vi.fn() }));
vi.mock('../../services/customersApi', () => ({
  fetchCustomers: vi.fn(),
  fetchCustomerStats: vi.fn(),
  fetchCustomer: vi.fn(),
  exportCustomersCsv: vi.fn(),
  createCustomer: vi.fn(),
  setCustomerBlock: vi.fn(),
  setCustomerNotes: vi.fn(),
  isApiErrorCode: () => false,
  apiErrorStatus: (): undefined => undefined,
}));
vi.mock('../../services/paddleApi', () => ({
  PLAN_NAMES: { plus: 'Lightor+', pro: 'Lightor Pro' },
  previewPlanChange: vi.fn(),
  changePlan: vi.fn(),
  fetchUpgradePlans: vi.fn(() => Promise.resolve([])),
  createCheckout: vi.fn(),
  openInlineCheckout: vi.fn(() => Promise.resolve(true)),
  closeCheckout: vi.fn(),
  onCheckoutEvent: vi.fn(() => () => {}),
  fetchPortalLinks: vi.fn(),
  cancelSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
}));
vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('../../lib/storePurchases', async (original) => ({ ...(await original<typeof import('../../lib/storePurchases')>()), storeSalesOn: () => false }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn() }));

const US = '+12125550142';
const IL = '+972501234567';
const inStore = (phone: string, ui: React.ReactElement) =>
  render(
    <Provider
      store={configureStore({
        reducer: combineReducers({ webConfig: webConfigReducer }),
        preloadedState: { webConfig: { data: { _id: 'wc1', contact: { phone } }, loading: false, error: null } } as never,
      })}
    >
      {ui}
    </Provider>,
  );

describe("a customer's last visit (LT-702)", () => {
  beforeEach(() => {
    vi.mocked(fetchCustomers).mockResolvedValue({
      success: true,
      count: 1,
      pagination: { total: 1, page: 1, limit: 20, pages: 1 },
      data: [{
        _id: 'c1', name: 'Dana Miller', phone: '+12125550101', phoneNormalized: '+12125550101', isBlocked: false, blockedAt: null,
        source: 'booking', firstSeenAt: '2026-01-01T12:00:00.000Z', lastSeenAt: '2026-06-01T12:00:00.000Z', createdAt: '2026-01-01T12:00:00.000Z',
        visits: 3, cancelled: 0, upcoming: 0, revenue: 300, lastVisit: '2026-06-01T12:00:00.000Z', nextVisit: null,
      }],
    } as never);
    vi.mocked(fetchCustomerStats).mockResolvedValue({
      totals: { customers: 1, blocked: 0, newThisMonth: 0, returning: 1 },
      top: { byVisits: [], byRevenue: [] },
    } as never);
  });

  it('an American business: "Jun 01, 2026"', async () => {
    inStore(US, <Customers />);
    expect(await screen.findByText('Jun 01, 2026')).toBeInTheDocument();
    expect(screen.queryByText('01 Jun 2026')).toBeNull();
  });

  it('an Israeli business: "01 Jun 2026", as before', async () => {
    inStore(IL, <Customers />);
    expect(await screen.findByText('01 Jun 2026')).toBeInTheDocument();
  });
});

describe("the Account page's next bill (LT-702)", () => {
  beforeEach(() => {
    vi.mocked(fetchMyEntitlements).mockResolvedValue({
      plan: 'plus',
      complimentary: false,
      manualPlan: null,
      limits: { monthlyAppointments: null },
      usage: { appointmentsThisMonth: 3 },
      pilot: null,
      bookingTerms: { included: 500, plusIncluded: 200, extraAgorot: null },
      store: { billedBy: null, products: { plus: [], pro: [], bookingPack: [] }, packBookings: 100 },
    } as never);
  });

  it('an American business: 12/1/2026', async () => {
    inStore(US, <BillingSection />);
    await waitFor(() => expect(screen.getByText('billing.nextBill 12/1/2026')).toBeInTheDocument());
  });

  it('an Israeli business: 01/12/2026, as before', async () => {
    inStore(IL, <BillingSection />);
    await waitFor(() => expect(screen.getByText('billing.nextBill 01/12/2026')).toBeInTheDocument());
  });
});
