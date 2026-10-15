import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import SortableImageItem from '../../components/portfolio/SortableImageItem';
import { aiService } from '../../services/aiApi';

/**
 * LT-346 — a gallery picture's description for screen readers: the owner
 * writes it (or asks the AI for a first draft from the picture, in the site's
 * language) beside the title, and saves both together.
 */

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null as null, transition: undefined as string | undefined, isDragging: false, isSorting: false }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/aiApi', () => ({ aiService: { describeImage: vi.fn() } }));

const ITEM = { url: 'pic.webp', title: 'Cake', description: '' };

describe('a gallery picture\'s description (LT-346)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is marked missing, drafted by the AI in the site\'s language, and saved with the title', async () => {
    vi.mocked(aiService.describeImage).mockResolvedValue('A three-tier wedding cake with white roses.');
    const onUpdate = vi.fn();
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={onUpdate} siteLanguage="en" />);

    expect(screen.getByText('portfolio.altMissing')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Cake');

    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.altSuggest' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'portfolio.altLabel' })).toHaveValue('A three-tier wedding cake with white roses.'));
    expect(aiService.describeImage).toHaveBeenCalledWith('pic.webp', 'en');

    fireEvent.change(screen.getByRole('textbox', { name: 'portfolio.altLabel' }), { target: { value: ' A wedding cake with white roses. ' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onUpdate).toHaveBeenCalledWith('pic.webp', { title: 'Cake', alt: 'A wedding cake with white roses.' });
  });

  it('a spent AI budget says so, and the field stays the owner\'s', async () => {
    vi.mocked(aiService.describeImage).mockRejectedValue({ response: { status: 429 } });
    render(<SortableImageItem item={{ ...ITEM, alt: 'Mine' }} onRemove={vi.fn()} onUpdate={vi.fn()} siteLanguage="he" />);

    expect(screen.queryByText('portfolio.altMissing')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.altSuggest' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('portfolio.altSuggestBudget'));
    expect(screen.getByRole('textbox', { name: 'portfolio.altLabel' })).toHaveValue('Mine');
  });
});
