import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import SortableImageItem from '../../components/portfolio/SortableImageItem';
import { aiService } from '../../services/aiApi';

/**
 * LT-346 — a gallery picture's description: the owner writes it (or asks the
 * AI for a first draft from the picture, in the site's language) beside the
 * title, and saves both together. LT-581 (Erel): it is the description
 * visitors see, not a text for screen readers; the picture can be edited with
 * AI here as in the site editor, and the change shows against the original.
 */

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null as null, transition: undefined as string | undefined, isDragging: false, isSorting: false }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../services/aiApi', () => ({ aiService: { describeImage: vi.fn(), editImage: vi.fn(), createImage: vi.fn() } }));
const plan = vi.hoisted(() => ({ editor: true }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => ({ limits: { aiImagesInEditor: plan.editor } })) }));
vi.mock('../../lib/platform', () => ({ canOfferPurchases: () => true, isNativeApp: () => false }));

const ITEM = { url: 'pic.webp', title: 'Cake', description: '' };

describe('a gallery picture\'s description (LT-346)', () => {
  beforeEach(() => { vi.clearAllMocks(); plan.editor = true; });

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
    expect(onUpdate).toHaveBeenCalledWith('pic.webp', { title: 'Cake', description: 'A wedding cake with white roses.' });
  });

  it("asks for a description, never a text for screen readers, and opens an older one as the description", () => {
    render(<SortableImageItem item={{ ...ITEM, alt: 'Old words' }} onRemove={vi.fn()} onUpdate={vi.fn()} siteLanguage="he" />);
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    const box = screen.getByRole('textbox', { name: 'portfolio.altLabel' });
    expect(box).toHaveValue('Old words');
    expect(box).toHaveAttribute('placeholder', 'portfolio.altPlaceholder');
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

  it('edits the picture with AI, shows it against the original, and hands the new one to the gallery', async () => {
    vi.mocked(aiService.editImage).mockResolvedValue('https://api.lightor.app/api/images/tmp-1.webp');
    const onReplace = vi.fn();
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} onReplace={onReplace} siteLanguage="he" />);

    fireEvent.click(screen.getByRole('button', { name: 'portfolio.aiEdit' }));
    const dialog = await screen.findByTestId('gallery-ai-edit');
    fireEvent.change(screen.getByLabelText('siteEditor.image.aiEditLabel'), { target: { value: 'a brighter background' } });
    fireEvent.click(screen.getByRole('button', { name: 'siteEditor.image.aiEditRun' }));
    const compare = await screen.findByTestId('ai-before-after');
    expect(aiService.editImage).toHaveBeenCalledWith('pic.webp', 'a brighter background');
    expect(compare).toHaveAttribute('aria-label', 'siteEditor.image.aiCompare');
    expect([...compare.querySelectorAll('img')].map((img) => img.getAttribute('alt'))).toEqual(['siteEditor.image.aiBefore', 'siteEditor.image.aiAfter']);
    expect(screen.getByRole('slider', { name: 'siteEditor.image.aiCompareHandle' })).toHaveAttribute('aria-valuenow', '50');

    fireEvent.click(screen.getByRole('button', { name: 'siteEditor.image.aiUse' }));
    expect(onReplace).toHaveBeenCalledWith('pic.webp', 'https://api.lightor.app/api/images/tmp-1.webp');
    expect(dialog).not.toBeInTheDocument();
  });

  it('on the free plan the dialog says AI pictures are on Lightor+, and edits nothing', async () => {
    plan.editor = false;
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} onReplace={vi.fn()} siteLanguage="he" />);
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.aiEdit' }));
    expect(await screen.findByTestId('ai-image-plus')).toBeInTheDocument();
    expect(aiService.editImage).not.toHaveBeenCalled();
  });

  it('offers no AI editing where the page cannot take the new picture', () => {
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} siteLanguage="he" />);
    expect(screen.queryByRole('button', { name: 'portfolio.aiEdit' })).toBeNull();
  });
});
