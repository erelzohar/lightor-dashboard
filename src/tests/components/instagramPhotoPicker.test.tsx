import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import InstagramPhotoPicker from '../../components/portfolio/InstagramPhotoPicker';

/**
 * The Instagram media picker (LT-042).
 *
 * Everything here runs against a mocked Graph API: the picker's contract is
 * that it walks /me/accounts to the linked professional account, flattens
 * media into image tiles (carousels expanded, videos dropped), respects the
 * portfolio cap, and hands the import callback nothing but CDN URLs.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

type FetchResponse = { data?: unknown[]; paging?: { next?: string }; error?: { message: string } };

const graphResponses = new Map<string, FetchResponse>();

const mockFetch = vi.fn(async (url: string) => {
  for (const [needle, body] of graphResponses) {
    if (url.includes(needle)) return { json: async () => body } as Response;
  }
  throw new Error(`unexpected fetch: ${url}`);
});

const pageWithIg = {
  name: 'Salon Page',
  instagram_business_account: { id: 'ig1', username: 'the_salon', media_count: 3 },
};

const media = [
  { id: 'm1', media_type: 'IMAGE', media_url: 'https://cdn/m1.jpg' },
  {
    id: 'm2',
    media_type: 'CAROUSEL_ALBUM',
    children: {
      data: [
        { id: 'c1', media_type: 'IMAGE', media_url: 'https://cdn/c1.jpg' },
        { id: 'c2', media_type: 'VIDEO', media_url: 'https://cdn/c2.mp4' },
      ],
    },
  },
  { id: 'm3', media_type: 'VIDEO', media_url: 'https://cdn/m3.mp4', thumbnail_url: 'https://cdn/m3.jpg' },
];

describe('InstagramPhotoPicker', () => {
  beforeEach(() => {
    graphResponses.clear();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockClear();
  });

  const renderPicker = (props: Partial<React.ComponentProps<typeof InstagramPhotoPicker>> = {}) =>
    render(
      <InstagramPhotoPicker
        accessToken="tok"
        remainingSlots={5}
        onClose={vi.fn()}
        onImport={vi.fn().mockResolvedValue(undefined)}
        {...props}
      />
    );

  it('auto-opens a single linked account and shows only image tiles', async () => {
    graphResponses.set('/me/accounts', { data: [pageWithIg] });
    graphResponses.set('/ig1/media', { data: media });

    renderPicker();

    // m1 and the carousel's image child — the two videos are dropped.
    await waitFor(() => expect(document.querySelectorAll('img[src^="https://cdn/"]')).toHaveLength(2));
    const srcs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(srcs).toEqual(['https://cdn/m1.jpg', 'https://cdn/c1.jpg']);
    // Auto-opened: the account header shows, not the account list.
    expect(screen.getByText('@the_salon')).toBeInTheDocument();
  });

  it('enforces the remaining-slots cap and imports only the picked URLs', async () => {
    graphResponses.set('/me/accounts', { data: [pageWithIg] });
    graphResponses.set('/ig1/media', { data: media });
    const onImport = vi.fn().mockResolvedValue(undefined);

    renderPicker({ remainingSlots: 1, onImport });
    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(2));

    const [first, second] = [...document.querySelectorAll('img')].map((i) => i.closest('button')!);
    fireEvent.click(first);
    fireEvent.click(second); // over the cap — must be a no-op

    fireEvent.click(screen.getByText('igImport.importSelected'));
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(['https://cdn/m1.jpg']));
  });

  it('shows the professional-account explanation when no page has a linked account', async () => {
    graphResponses.set('/me/accounts', { data: [{ name: 'Page without IG' }] });

    renderPicker();

    await waitFor(() => expect(screen.getByText('igImport.noAccounts')).toBeInTheDocument());
    // This is the empty state, not the failure state.
    expect(screen.queryByText('igImport.loadFailed')).toBeNull();
  });

  it('surfaces a Graph error as the failure state', async () => {
    graphResponses.set('/me/accounts', { error: { message: 'expired token' } });

    renderPicker();

    await waitFor(() => expect(screen.getByText('igImport.loadFailed')).toBeInTheDocument());
  });
});

describe('InstagramPhotoPicker · Instagram Login source', () => {
  beforeEach(() => {
    graphResponses.clear();
    vi.stubGlobal('fetch', mockFetch);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    mockFetch.mockClear();
  });

  it('resolves /me on graph.instagram.com and never walks Facebook pages', async () => {
    graphResponses.set('graph.instagram.com/me?', { username: 'ig_only_salon' } as never);
    graphResponses.set('graph.instagram.com/me/media', { data: media });

    render(
      <InstagramPhotoPicker
        accessToken="ig-tok"
        source="instagram"
        remainingSlots={5}
        onClose={vi.fn()}
        onImport={vi.fn().mockResolvedValue(undefined)}
      />
    );

    await waitFor(() => expect(document.querySelectorAll('img')).toHaveLength(2));
    expect(screen.getByText('@ig_only_salon')).toBeInTheDocument();
    const urls = mockFetch.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.startsWith('https://graph.instagram.com/'))).toBe(true);
    expect(urls.some((u) => u.includes('/me/accounts'))).toBe(false);
  });
});
