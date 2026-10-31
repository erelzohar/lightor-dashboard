import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyText } from '../../utils/copyText';

/** LT-501: the clipboard API where it is allowed, else select-and-copy; the answer says if it worked. */
describe('copyText', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the clipboard where it is allowed', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const execCommand = vi.fn(() => true);
    document.execCommand = execCommand;

    await expect(copyText('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('falls back to select-and-copy when the clipboard refuses, as an Android WebView does', async () => {
    const refused = Object.assign(new Error('Write permission denied.'), { name: 'NotAllowedError' });
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(() => Promise.reject(refused)) } });
    let selected = '';
    document.execCommand = vi.fn(() => {
      selected = document.querySelector('textarea')?.value ?? '';
      return true;
    });

    await expect(copyText('hello')).resolves.toBe(true);
    expect(selected).toBe('hello');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when there is no clipboard API at all', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });
    document.execCommand = vi.fn(() => true);
    await expect(copyText('hello')).resolves.toBe(true);
  });

  it('says false when both ways fail, and leaves nothing behind', async () => {
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: vi.fn(() => Promise.reject(new Error('no'))) } });
    document.execCommand = vi.fn(() => {
      throw new Error('not allowed');
    });
    await expect(copyText('hello')).resolves.toBe(false);
    expect(document.querySelector('textarea')).toBeNull();
  });
});
