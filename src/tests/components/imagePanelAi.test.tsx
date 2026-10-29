import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ImagePanel from '../../components/siteEditor/ImagePanel';
import { aiService } from '../../services/aiApi';
import { fetchMyEntitlements, MyEntitlements } from '../../services/entitlementsApi';
import { canOfferPurchases } from '../../lib/platform';

/** LT-366: the editor's "create a picture with AI", kept only when the owner picks it. */

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../services/aiApi', () => ({ aiService: { createImage: vi.fn() } }));
vi.mock('../../services/entitlementsApi', () => ({ fetchMyEntitlements: vi.fn().mockResolvedValue(null) }));
vi.mock('../../lib/platform', () => ({ canOfferPurchases: vi.fn(() => true) }));

const renderPanel = (path = 'components.hero.heroImageSrc') => {
  const onChange = vi.fn();
  const onUploaded = vi.fn();
  render(<ImagePanel path={path} value="" siteImages={[]} onChange={onChange} onUploaded={onUploaded} />);
  fireEvent.click(screen.getByText('siteEditor.image.aiOpen'));
  return { onChange, onUploaded };
};

const ask = (words: string) => {
  fireEvent.change(screen.getByLabelText('siteEditor.image.aiLabel'), { target: { value: words } });
  fireEvent.click(screen.getByText('siteEditor.image.aiCreate'));
};

describe('ImagePanel - AI picture', () => {
  it('creates a picture in the slot\'s shape and uses it only when the owner picks it', async () => {
    vi.mocked(aiService.createImage).mockResolvedValueOnce('https://api.lightor.app/api/images/tmp-ai-1.webp');
    const { onChange, onUploaded } = renderPanel();
    ask('a car lot');
    expect(aiService.createImage).toHaveBeenLastCalledWith('a car lot', '16:9');
    await screen.findByText('siteEditor.image.aiUse');
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('siteEditor.image.aiUse'));
    expect(onChange).toHaveBeenCalledWith('https://api.lightor.app/api/images/tmp-ai-1.webp');
    // Not an upload: nothing to clean up, the temporary picture expires by itself.
    expect(onUploaded).not.toHaveBeenCalled();
  });

  it('asks for a square for the logo', async () => {
    vi.mocked(aiService.createImage).mockResolvedValueOnce('x');
    renderPanel('logoImageName');
    ask('a logo mark');
    expect(aiService.createImage).toHaveBeenLastCalledWith('a logo mark', '1:1');
    await screen.findByText('siteEditor.image.aiUse');
  });

  it('says when this month\'s pictures are used up', async () => {
    vi.mocked(aiService.createImage).mockRejectedValueOnce({ response: { status: 429 } });
    renderPanel();
    ask('a car lot');
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('siteEditor.image.aiLimit'));
  });

  // LT-489 (Erel 2026-10-29): the free plan's AI pictures are its build's.
  describe('on the free plan', () => {
    const free = { plan: 'free', limits: { aiImagesInEditor: false }, usage: {} } as unknown as MyEntitlements;
    afterEach(() => { vi.mocked(canOfferPurchases).mockReturnValue(true); });
    const renderLocked = () =>
      render(<ImagePanel path="components.hero.heroImageSrc" value="" siteImages={[]} onChange={vi.fn()} onUploaded={vi.fn()} />);

    it('says on the web that the editor makes AI pictures on Plus, with nothing to create', async () => {
      vi.mocked(fetchMyEntitlements).mockResolvedValueOnce(free);
      renderLocked();
      expect(await screen.findByTestId('ai-image-plus')).toHaveTextContent('siteEditor.image.aiPlusOnly');
      expect(screen.queryByText('siteEditor.image.aiOpen')).not.toBeInTheDocument();
    });

    it('in the app shows nothing in its place (no call to buy)', async () => {
      vi.mocked(fetchMyEntitlements).mockResolvedValueOnce(free);
      vi.mocked(canOfferPurchases).mockReturnValue(false);
      renderLocked();
      await waitFor(() => expect(screen.queryByTestId('ai-image')).not.toBeInTheDocument());
      expect(screen.queryByTestId('ai-image-plus')).not.toBeInTheDocument();
    });

    it('locks when the server says so, even if the plan was not read', async () => {
      vi.mocked(aiService.createImage).mockRejectedValueOnce({ response: { status: 429, data: { code: 'AI_IMAGES_PLUS' } } });
      renderPanel();
      ask('a car lot');
      expect(await screen.findByTestId('ai-image-plus')).toHaveTextContent('siteEditor.image.aiPlusOnly');
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  it('waits for a few words before creating', () => {
    vi.mocked(aiService.createImage).mockClear();
    renderPanel();
    ask('a');
    expect(aiService.createImage).not.toHaveBeenCalled();
  });
});
