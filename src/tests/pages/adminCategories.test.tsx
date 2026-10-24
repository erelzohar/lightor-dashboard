import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminCategories from '../../pages/admin/AdminCategories';
import { fetchAdminCategories, mergeAdminCategory, deleteAdminCategory, updateAdminCategory, AdminCategoryRow } from '../../services/adminApi';
import { choose } from '../helpers/dropdown';

const { t } = vi.hoisted(() => ({ t: (key: string) => key }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../contexts/ThemeContext', () => ({ useTheme: () => ({ direction: 'ltr' }) }));
vi.mock('../../services/adminApi', () => ({
  fetchAdminCategories: vi.fn(),
  updateAdminCategory: vi.fn(async () => undefined),
  mergeAdminCategory: vi.fn(async () => ({ sites: 1 })),
  deleteAdminCategory: vi.fn(async () => undefined),
}));

const names = (he: string, en: string) => ({ he, en, ar: en, fr: en, es: en });
const row = (over: Partial<AdminCategoryRow>): AdminCategoryRow => ({
  key: 'nails', main: 'beauty', names: names('ציפורניים', 'Nails'), aliases: [], source: 'seed', sites: 2, ...over,
});
const list = () => ({
  mains: [{ key: 'beauty', names: names('יופי', 'Beauty') }, { key: 'fitness', names: names('כושר', 'Fitness') }],
  subs: [
    row({}),
    row({ key: 'reformer-pilates', main: 'fitness', names: names('פילאטיס מכשירים', 'Reformer pilates'), source: 'ai', sites: 1 }),
    row({ key: 'pilates', main: 'fitness', names: names('פילאטיס', 'Pilates'), sites: 0 }),
  ],
});

/** LT-453: Admin → Categories - the AI's additions fixed, merged, or deleted when unused. */
describe('Admin categories', () => {
  beforeEach(() => {
    vi.mocked(fetchAdminCategories).mockReset().mockResolvedValue(list());
    vi.mocked(mergeAdminCategory).mockClear();
    vi.mocked(deleteAdminCategory).mockClear();
    vi.mocked(updateAdminCategory).mockClear();
  });

  it('lists every sub-category with its sites and marks what the AI added; filters to those', async () => {
    render(<AdminCategories />);
    expect(await screen.findByText('Reformer pilates · reformer-pilates')).toBeTruthy();
    expect(screen.getAllByText('admin.categories.fromAi')).toHaveLength(1);
    fireEvent.click(screen.getByLabelText('admin.categories.onlyAi'));
    await waitFor(() => expect(screen.queryByText('Nails · nails')).toBeNull());
    expect(screen.getByText('Reformer pilates · reformer-pilates')).toBeTruthy();
  });

  it('merges a duplicate into the one it repeats, then reloads', async () => {
    render(<AdminCategories />);
    await screen.findByText('Reformer pilates · reformer-pilates');
    // Sorted by main, then name: nails, pilates, reformer pilates.
    fireEvent.click(screen.getAllByRole('button', { name: 'admin.categories.merge' })[2]);
    const into = screen.getAllByLabelText('admin.categories.mergeInto').find((el) => el.tagName === 'BUTTON')!;
    choose(into, 'pilates');
    fireEvent.click(screen.getByRole('button', { name: 'admin.categories.mergeConfirm' }));
    await waitFor(() => expect(mergeAdminCategory).toHaveBeenCalledWith('reformer-pilates', 'pilates'));
    await waitFor(() => expect(fetchAdminCategories).toHaveBeenCalledTimes(2));
  });

  it('saves a fixed name in all five languages', async () => {
    render(<AdminCategories />);
    await screen.findByText('Nails · nails');
    fireEvent.click(screen.getAllByRole('button', { name: 'admin.categories.edit' })[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByDisplayValue('ציפורניים'), { target: { value: 'סטודיו לציפורניים' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'admin.categories.save' }));
    await waitFor(() => expect(updateAdminCategory).toHaveBeenCalledWith('nails', { names: { ...names('ציפורניים', 'Nails'), he: 'סטודיו לציפורניים' } }));
  });

  it('deletes only an unused one', async () => {
    render(<AdminCategories />);
    await screen.findByText('Pilates · pilates');
    const deletes = screen.getAllByRole('button', { name: 'admin.categories.delete' });
    // Sorted by main, then name: nails (beauty, 2 sites), pilates (fitness, 0), reformer (fitness, 1).
    expect(deletes.map((b) => (b as HTMLButtonElement).disabled)).toEqual([true, false, true]);
    fireEvent.click(deletes[1]);
    fireEvent.click(await screen.findByRole('button', { name: 'admin.categories.deleteConfirm' }));
    await waitFor(() => expect(deleteAdminCategory).toHaveBeenCalledWith('pilates'));
  });
});
