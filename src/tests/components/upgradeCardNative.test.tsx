import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import UpgradeCard from '../../components/customers/UpgradeCard';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

const w = window as unknown as { Capacitor?: unknown };
afterEach(() => {
  delete w.Capacitor;
});

/**
 * The card is a call to buy, so it must never appear inside the app (LT-130,
 * App Store 3.1.1). The guard lives in the card itself, so no future page can
 * put it in front of an app user by accident.
 */
describe('UpgradeCard', () => {
  it('shows its prompt on the web', () => {
    render(<UpgradeCard title="Plus only" description="desc" />);
    expect(screen.getByText('Plus only')).toBeInTheDocument();
    expect(screen.getByText('common.upgradePlanBtn')).toBeInTheDocument();
  });

  it('renders nothing inside the app', () => {
    w.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    const { container } = render(<UpgradeCard title="Plus only" description="desc" />);
    expect(container).toBeEmptyDOMElement();
  });
});
