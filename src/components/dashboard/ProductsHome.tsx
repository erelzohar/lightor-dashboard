import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import StatsBand, { type BandStat } from './StatsBand';
import TopProducts from './TopProducts';
import ProductPicks from './ProductPicks';
import LeadsSummary from './LeadsSummary';
import ErrorBoundaryWithLanguage from '../ui/ErrorBoundary';
import DashboardFallback from './DashboardFallback';
import { monthChange } from './LeadsStats';
import { askRate, litDots, rankProducts } from '../../lib/productsHome';
import type { LeadsPage, LeadStats } from '../../services/leadsApi';
import type { Product, ProductViews } from '../../services/productsApi';

/** "15.11" from "2026-11-15". */
const dayLabel = (day: string): string => {
  const [, m, d] = day.split('-');
  return `${Number(d)}.${Number(m)}`;
};

/**
 * LT-624 (Erel 2026-11-09: "the products dashboard and the leads dashboard look exactly the
 * same - vary it, maybe show the best-selling products' cards", with his stats band): a
 * products site's home is the shop's. A band of four numbers with a picture each (this
 * month's inquiries, the products' views, inquiries in every hundred views, and who waits for
 * an answer), the products visitors want most as cards, the colours and sizes they ask for,
 * and the latest inquiries with the product each one is about.
 */
const ProductsHome: React.FC<{
  stats: LeadStats | null;
  page: LeadsPage | null;
  products: Product[] | null;
  views: ProductViews | null;
  currency?: string;
  language: string;
  direction: 'ltr' | 'rtl';
}> = ({ stats, page, products, views, currency, language, direction }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const interest = stats?.products ?? null;
  const ranked = useMemo(() => (products ? rankProducts(products, interest, views) : null), [products, interest, views]);
  const picks = interest?.picks ?? [];

  const band = useMemo((): BandStat[] | null => {
    if (!stats) return null;
    const rate = askRate(views, interest);
    const last = stats.perDay[stats.perDay.length - 1];
    const topViewed = products && views
      ? products.reduce<{ name: string; n: number } | null>((best, p) => {
          const n = views.byProduct[p._id] ?? 0;
          return n > 0 && (!best || n > best.n) ? { name: p.name, n } : best;
        }, null)
      : null;
    const viewsSince = views?.since && views.perDay.length && views.since > views.perDay[0].date ? views.since : null;
    const { total, handled } = stats.last30;
    return [
      {
        key: 'inquiries',
        label: t('dashboard.productsHome.inquiries'),
        value: stats.thisMonth,
        change: monthChange(stats.thisMonth, stats.lastMonthToDate ?? stats.lastMonth),
        detail: t('dashboard.leadsStats.lastMonth', { count: stats.lastMonthToDate ?? stats.lastMonth }),
        context: last ? t('dashboard.productsHome.today', { count: last.count }) : undefined,
        visual: { kind: 'trend', values: stats.perDay.map((d) => d.count) },
      },
      {
        key: 'views',
        label: t('dashboard.productsHome.views'),
        value: views ? views.total : null,
        detail: viewsSince ? t('dashboard.leadsStats.countedSince', { date: dayLabel(viewsSince) }) : t('dashboard.leadsStats.last30'),
        context: topViewed ? t('dashboard.productsHome.mostViewed', { name: topViewed.name }) : undefined,
        ...(views ? { visual: { kind: 'bars' as const, values: views.perDay.map((d) => d.count) } } : {}),
      },
      {
        key: 'rate',
        label: t('dashboard.productsHome.rate'),
        value: rate ? rate.rate : null,
        decimals: rate && !Number.isInteger(rate.rate) ? 1 : 0,
        detail: rate ? t('dashboard.productsHome.rateOf', { asks: rate.asks, views: rate.views }) : t('dashboard.productsHome.rateNotYet'),
        visual: { kind: 'hundred', lit: rate ? litDots(rate.rate) : 0 },
      },
      {
        key: 'waiting',
        label: t('dashboard.leadsStats.waiting'),
        value: stats.waiting,
        detail: stats.waiting > 0 ? t('dashboard.leadsStats.waitingCta') : t('dashboard.leadsStats.waitingNone'),
        context: total > 0 ? t('dashboard.productsHome.handledOf', { handled, total }) : undefined,
        visual: { kind: 'split', part: total - handled, whole: total },
        tone: stats.waiting > 0 ? 'warning' : 'default',
        onClick: () => navigate('/leads?status=new'),
      },
    ];
  }, [stats, views, interest, products, t, navigate]);

  // Every inquiry about a product shows its picture, as the product has it now.
  const pictureOf = useMemo(() => {
    const byId = new Map((products ?? []).map((p) => [p._id, p.images[0]?.url]));
    return (id: string | undefined) => (id ? byId.get(id) : undefined);
  }, [products]);

  const fallback = (title: string) => <DashboardFallback language={language} title={title} />;

  return (
    <>
      {band && (
        <div data-tour="stats">
          <ErrorBoundaryWithLanguage fallback={fallback(t('common.errorLoadingStats'))}>
            <StatsBand stats={band} label={t('dashboard.productsHome.bandLabel')} language={i18n.language} />
          </ErrorBoundaryWithLanguage>
        </div>
      )}

      {ranked && (
        <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-3">
          <div className={picks.length ? 'lg:col-span-2' : 'lg:col-span-3'}>
            <ErrorBoundaryWithLanguage fallback={fallback(t('common.errorLoadingStats'))}>
              <TopProducts ranked={ranked} currency={currency} direction={direction} narrow={picks.length > 0} />
            </ErrorBoundaryWithLanguage>
          </div>
          {picks.length > 0 && (
            <div className="lg:col-span-1">
              <ErrorBoundaryWithLanguage fallback={fallback(t('common.errorLoadingStats'))}>
                <ProductPicks picks={picks} />
              </ErrorBoundaryWithLanguage>
            </div>
          )}
        </div>
      )}

      <ErrorBoundaryWithLanguage fallback={fallback(t('leads.errors.loadFailed'))}>
        <LeadsSummary
          page={page}
          direction={direction}
          title={t('dashboard.productsHome.latest')}
          viewAll={t('dashboard.productsHome.viewAll')}
          pictureOf={pictureOf}
        />
      </ErrorBoundaryWithLanguage>
    </>
  );
};

export default ProductsHome;
