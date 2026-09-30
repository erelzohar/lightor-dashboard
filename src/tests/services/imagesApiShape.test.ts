import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../../services/apiClient';
import { uploadImage } from '../../services/imagesApi';

vi.mock('../../services/apiClient', () => ({ default: { post: vi.fn() } }));

/**
 * LT-210: the server fits an upload by the multipart `shape` field. `photo`
 * keeps the picture's shape; no field keeps the transparent square that
 * logos rely on, so a logo upload must not send one.
 */
describe('uploadImage shape', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { imageName: 'n.webp' } } });
  });

  const sent = () => vi.mocked(apiClient.post).mock.calls[0][1] as FormData;
  const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

  it('sends shape=photo when asked', async () => {
    await uploadImage(file, 'photo');
    expect(sent().get('shape')).toBe('photo');
    expect(sent().get('image')).toBeInstanceOf(File);
  });

  it('sends no shape otherwise', async () => {
    vi.mocked(apiClient.post).mockClear();
    await uploadImage(file);
    expect(sent().has('shape')).toBe(false);
  });
});
