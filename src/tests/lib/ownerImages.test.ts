import { describe, it, expect } from 'vitest';
import { addImages, shrinkImage } from '../../lib/ownerImages';
import { stylePicture, withLook } from '../../lib/styles';

const file = (name: string, type = 'image/png', size = 1) => new File([new Uint8Array(size)], name, { type });

describe('the chat pictures (LT-426, as the register LT-381)', () => {
  it('adds pictures of a kind the server takes, up to three', () => {
    const a = file('a.png');
    expect(addImages([], [a, file('b.jpg', 'image/jpeg')])).toEqual({ images: [a, expect.objectContaining({ name: 'b.jpg' })], refused: false });
    expect(addImages([a], [file('c.gif', 'image/gif')])).toEqual({ images: [a], refused: true });
    expect(addImages([a, a, a], [file('d.webp', 'image/webp')]).refused).toBe(true);
  });

  it('sends a small picture as it is, and one the browser cannot draw as it is', async () => {
    const small = file('small.png');
    expect(await shrinkImage(small)).toBe(small);
    // jsdom draws nothing (no createImageBitmap): the server decides.
    const big = file('big.jpg', 'image/jpeg', 2 * 1024 * 1024);
    expect(await shrinkImage(big)).toBe(big);
  });
});

describe('the style pictures and looks (LT-426)', () => {
  it('shows the Hebrew café to a Hebrew dashboard and the English one otherwise', () => {
    expect(stylePicture('serene', 'he')).toBe('/styles/serene.webp');
    expect(stylePicture('serene', 'en')).toBe('/styles/en/serene.webp');
    expect(stylePicture('serene', 'ar')).toBe('/styles/en/serene.webp');
  });

  it('puts the look on the site: its design, its palette over the old one, and blocks without their own variants', () => {
    const site = { businessName: 'Noga', design: { stylePreset: 'crisp', borderRadius: 'none' }, pallete: { colorPrimary: '#111111', colorLightBg: '#ffffff' }, blocks: [{ type: 'hero', variant: 'split' }] };
    const next = withLook(site, { design: { stylePreset: 'serene' }, pallete: { colorLightBg: '#f5f0e8' } });
    expect(next).toEqual({ businessName: 'Noga', design: { stylePreset: 'serene' }, pallete: { colorPrimary: '#111111', colorLightBg: '#f5f0e8' }, blocks: [{ type: 'hero' }] });
  });
});
