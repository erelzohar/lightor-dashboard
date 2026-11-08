import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlanCompare from '../../components/account/PlanCompare';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/** LT-615 (the LT-495 plan's announcement, Erel 2026-11-08): the blog is a row of every plan table. */
describe("the blog's row", () => {
  it("is in Pro's \"your plan includes\", on a booking site and on a leads or products site", () => {
    const { unmount } = render(<PlanCompare mode="includes" plan="pro" price="₪0.35" />);
    expect(screen.getByText('billing.pricing.rows.blog.pro')).toBeInTheDocument();
    unmount();
    render(<PlanCompare mode="includes" plan="pro" price="₪0.35" leadsSite />);
    expect(screen.getByText('billing.pricing.rows.blog.pro')).toBeInTheDocument();
  });

  it('is in the comparison, after the products', () => {
    render(<PlanCompare mode="compare" price="₪0.35" />);
    const labels = screen.getAllByRole('rowheader').map((cell) => cell.textContent);
    expect(labels.indexOf('billing.compare.rows.blog.label')).toBe(labels.indexOf('billing.compare.rows.products.label') + 1);
    expect(screen.getByText('billing.compare.rows.blog.pro')).toBeInTheDocument();
  });
});
