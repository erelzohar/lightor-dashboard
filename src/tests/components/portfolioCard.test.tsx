import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SortableImageItem from '../../components/portfolio/SortableImageItem';
import { aiService } from '../../services/aiApi';

/**
 * The gallery's picture card. LT-582 (Erel 2026-11-05): a picture has a title
 * only - no description, no text for screen readers, no AI suggestion for one
 * (LT-346 and LT-581 had them). LT-581: the picture can be edited with AI here
 * as in the site editor, and the change shows against the original.
 */

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null as null, transition: undefined as string | undefined, isDragging: false, isSorting: false }),
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/aiApi', () => ({ aiService: { editImage: vi.fn(), createImage: vi.fn() } }));
const plan = vi.hoisted(() => ({ editor: true }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn(async () => ({ limits: { aiImagesInEditor: plan.editor } })) }));
vi.mock('../../lib/platform', () => ({ canOfferPurchases: () => true, isNativeApp: () => false }));

const ITEM = { url: 'pic.webp', title: 'Cake', description: '' };

describe('a gallery picture has a title only (LT-582)', () => {
  beforeEach(() => { vi.clearAllMocks(); plan.editor = true; });

  it('asks for the title alone and saves only the title', () => {
    const onUpdate = vi.fn();
    render(<SortableImageItem item={{ ...ITEM, description: 'An older caption', alt: 'Old words' }} onRemove={vi.fn()} onUpdate={onUpdate} />);

    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    const fields = screen.getAllByRole('textbox');
    expect(fields).toHaveLength(1);
    expect(fields[0]).toHaveAccessibleName('portfolio.enterTitle');
    expect(fields[0]).toHaveValue('Cake');
    // Nothing else to fill in, and nothing that drafts a description.
    expect(screen.queryByDisplayValue('An older caption')).toBeNull();
    expect(screen.queryByDisplayValue('Old words')).toBeNull();
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['common.cancel', 'common.save']);

    fireEvent.change(fields[0], { target: { value: ' Wedding cake ' } });
    fireEvent.click(screen.getByRole('button', { name: 'common.save' }));
    expect(onUpdate).toHaveBeenCalledWith('pic.webp', { title: 'Wedding cake' });
  });

  // LT-637 (Erel): nothing changed, nothing sent.
  it('keeps the check off until the title changes, and sends nothing for the same one', () => {
    const onUpdate = vi.fn();
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    const title = screen.getByRole('textbox', { name: 'portfolio.enterTitle' });
    const check = screen.getByRole('button', { name: 'common.save' });
    expect(check).toBeDisabled();
    fireEvent.keyDown(title, { key: 'Enter' });
    fireEvent.change(title, { target: { value: ' Cake ' } });
    expect(check).toBeDisabled();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.change(title, { target: { value: 'Birthday cake' } });
    expect(check).toBeEnabled();
    fireEvent.keyDown(title, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('pic.webp', { title: 'Birthday cake' });
  });

  it('marks nothing as missing, and names the card\'s picture by its title', () => {
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Cake');
    expect(screen.queryByText(/altMissing/)).toBeNull();
    expect(screen.getByText('Cake')).toBeInTheDocument();
  });

  it('Escape leaves the title as it was', () => {
    const onUpdate = vi.fn();
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    const title = screen.getByRole('textbox', { name: 'portfolio.enterTitle' });
    fireEvent.change(title, { target: { value: 'Something else' } });
    fireEvent.keyDown(title, { key: 'Escape' });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.editTitle' }));
    expect(screen.getByRole('textbox', { name: 'portfolio.enterTitle' })).toHaveValue('Cake');
  });
});

describe('editing a gallery picture with AI (LT-581)', () => {
  beforeEach(() => { vi.clearAllMocks(); plan.editor = true; });

  it('edits the picture with AI, shows it against the original, and hands the new one to the gallery', async () => {
    vi.mocked(aiService.editImage).mockResolvedValue('https://api.lightor.app/api/images/tmp-1.webp');
    const onReplace = vi.fn();
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} onReplace={onReplace} />);

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
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} onReplace={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'portfolio.aiEdit' }));
    expect(await screen.findByTestId('ai-image-plus')).toBeInTheDocument();
    expect(aiService.editImage).not.toHaveBeenCalled();
  });

  it('offers no AI editing where the page cannot take the new picture', () => {
    render(<SortableImageItem item={ITEM} onRemove={vi.fn()} onUpdate={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'portfolio.aiEdit' })).toBeNull();
  });
});
