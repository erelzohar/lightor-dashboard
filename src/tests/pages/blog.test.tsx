import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Blog from '../../pages/Blog';
import { createPost, deletePost, draftPictures, draftPost, getPost, listPosts, postIdeas, updatePost, type Post } from '../../services/postsApi';
import { PICTURES_POLL } from '../../components/blog/PostEditor';
import { sitePicturesOf } from '../../components/blog/blogPictures';
import { blogLooksOf, withBlogSection } from '../../utils/blogLooks';
import { blockLookOf } from '../../utils/editorOptions';
import { previewPostOf } from '../../components/blog/PostPreview';
import toast from 'react-hot-toast';

/**
 * LT-610 (the LT-495 plan, Erel 2026-11-07): the dashboard's Blog page. Pro
 * writes, by hand or with Lighty's draft; every other plan sees the page
 * locked (and posts kept from Pro, which can be deleted).
 */

const i18n = vi.hoisted(() => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key), i18n: { language: 'he', dir: () => 'rtl' } }));
vi.mock('react-i18next', () => ({ useTranslation: () => i18n }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('browser-image-compression', () => ({ default: (file: File) => Promise.resolve(file) }));
const site = vi.hoisted(() => ({ current: { subDomain: 'studio', defaultLanguage: 'he', components: { hero: { heroImageSrc: 'hero.webp' }, portfolio: { items: [{ url: 'a.webp' }] } } } as Record<string, unknown> }));
vi.mock('../../hooks/useAppSelector', () => ({
  useAppSelector: (selector: (s: unknown) => unknown) => selector({ webConfig: { data: site.current } }),
}));
const platform = vi.hoisted(() => ({ canOfferPurchases: vi.fn(() => true), isNativeApp: () => false }));
vi.mock('../../lib/platform', () => platform);
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn() }));
vi.mock('../../services/aiApi', () => ({ aiService: { createImage: vi.fn() } }));
vi.mock('../../services/postsApi', async (original) => ({
  ...(await original<typeof import('../../services/postsApi')>()),
  listPosts: vi.fn(), getPost: vi.fn(), createPost: vi.fn(), updatePost: vi.fn(), deletePost: vi.fn(), postIdeas: vi.fn(), draftPost: vi.fn(), draftPictures: vi.fn(),
}));

const PRO = { blog: true, draftsPerMonth: 10, draftsLeft: 7, publishesPerMonth: 30, publishesLeft: 30 };
const post = (extra: Partial<Post> = {}): Post => ({
  _id: 'p1', slug: 'gel-nails', title: 'לק ג׳ל שמחזיק', summary: 'שלושה טיפים', status: 'draft', createdAt: '2026-11-01T09:00:00Z', updatedAt: '2026-11-02T09:00:00Z', ...extra,
});
const renderPage = () => render(<MemoryRouter><Blog /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  platform.canOfferPurchases.mockReturnValue(true);
});

describe('the Blog page on Pro (LT-610)', () => {
  it('lists the posts with their state, and how many of Lighty\'s drafts are left', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [post(), post({ _id: 'p2', title: 'בחוץ', status: 'published', publishedAt: '2026-11-03T09:00:00Z' }), post({ _id: 'p3', title: 'הוסתר', status: 'published', hiddenByAdmin: true })], limits: PRO });
    renderPage();
    const rows = await screen.findAllByTestId('blog-post-row');
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText('blog.status.draft')).toBeTruthy();
    expect(within(rows[1]).getByText('blog.status.published')).toBeTruthy();
    expect(within(rows[2]).getByText('blog.status.hidden')).toBeTruthy();
    expect(screen.getByTestId('blog-drafts-left').textContent).toContain('"left":7');
    expect(screen.getByRole('link', { name: /blog.seeOnSite/ }).getAttribute('href')).toBe('https://studio.lightor.app/blog');
    expect(screen.queryByTestId('blog-locked')).toBeNull();
  });

  it("writes a post with Lighty: a topic, the owner's words, a draft saved at once and opened", async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: PRO });
    vi.mocked(postIdeas).mockResolvedValue([{ title: 'איך שומרים על הלק', angle: 'טיפים לבית' }]);
    vi.mocked(draftPost).mockResolvedValue({ draft: { title: 'איך שומרים על הלק', summary: 'ש', category: 'טיפים', slug: 'gel-care', cover: 'a.webp', body: [{ kind: 'p', text: 'פסקה.' }] }, draftsLeft: 6 });
    vi.mocked(createPost).mockImplementation(async (input) => post({ ...input, _id: 'new', cover: input.cover ? { url: input.cover } : null, body: input.body } as Partial<Post>));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /blog.lightyWrites/ }))[0]);
    const dialog = await screen.findByTestId('lighty-writes');
    fireEvent.click(await within(dialog).findByText('איך שומרים על הלק'));
    fireEvent.change(within(dialog).getByLabelText('blog.lighty.words'), { target: { value: 'אני ממליצה על כפפות' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /blog.lighty.write/ }));
    await waitFor(() => expect(draftPost).toHaveBeenCalledWith('איך שומרים על הלק', 'אני ממליצה על כפפות'));
    await waitFor(() => expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ title: 'איך שומרים על הלק', status: 'draft', byLighty: true, slug: 'gel-care', cover: 'a.webp' })));
    expect(await screen.findByTestId('post-editor')).toBeTruthy();
    expect(screen.getByTestId('blog-drafts-left').textContent).toContain('"left":6');
  });

  /** Lighty writes a three-paragraph draft whose pictures are on their way (LT-610). */
  const writeWithPictures = async () => {
    PICTURES_POLL.firstMs = 5;
    PICTURES_POLL.everyMs = 5;
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: PRO });
    vi.mocked(postIdeas).mockResolvedValue([{ title: 'איך שומרים על הלק', angle: 'טיפים לבית' }]);
    vi.mocked(draftPost).mockResolvedValue({
      draft: { title: 'איך שומרים על הלק', summary: 'ש', category: 'טיפים', slug: 'gel-care', cover: '', body: [{ kind: 'p', text: 'פתיחה.' }, { kind: 'h2', text: 'כפפות' }, { kind: 'p', text: 'סיום.' }] },
      draftsLeft: 6,
      pictures: { job: 'job-1', inside: [1, 2] },
    });
    vi.mocked(createPost).mockImplementation(async (input) => post({ ...input, _id: 'new', cover: input.cover ? { url: input.cover } : null, body: input.body } as Partial<Post>));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /blog.lightyWrites/ }))[0]);
    const dialog = await screen.findByTestId('lighty-writes');
    fireEvent.click(await within(dialog).findByText('איך שומרים על הלק'));
    fireEvent.click(within(dialog).getByRole('button', { name: /blog.lighty.write/ }));
    return screen.findByTestId('post-editor');
  };

  it("puts Lighty's pictures in once they are made, and keeps them in the draft (LT-610)", async () => {
    let asked = 0;
    vi.mocked(draftPictures).mockImplementation(async () => (++asked < 3
      ? { done: false, pictures: { 'img-1': null } }
      : { done: true, pictures: { cover: 'https://api.lightor.app/api/images/tmp-ai-c.webp', 'img-0': 'a.webp', 'img-1': null } }));
    vi.mocked(updatePost).mockImplementation(async (_id, input) => post({
      ...input, _id: 'new', cover: input.cover ? { url: input.cover.replace('tmp-ai-c.webp', 'kept-c.webp') } : null, body: input.body,
    } as Partial<Post>));
    const editor = await writeWithPictures();
    // While they are made: a place for the main picture and one for each picture inside.
    expect(within(editor).getByTestId('cover-pending')).toBeTruthy();
    expect(within(editor).getAllByTestId('picture-pending')).toHaveLength(2);
    expect(createPost).toHaveBeenCalledWith(expect.objectContaining({ cover: null, body: [{ kind: 'p', text: 'פתיחה.' }, { kind: 'h2', text: 'כפפות' }, { kind: 'p', text: 'סיום.' }] }));
    // Then all at once, and saved quietly: the cover, the gallery picture after the opening, and no empty place.
    await waitFor(() => expect(updatePost).toHaveBeenCalledWith('new', expect.objectContaining({
      status: 'draft',
      cover: 'https://api.lightor.app/api/images/tmp-ai-c.webp',
      body: [{ kind: 'p', text: 'פתיחה.' }, { kind: 'image', url: 'a.webp' }, { kind: 'h2', text: 'כפפות' }, { kind: 'p', text: 'סיום.' }],
    })));
    expect(draftPictures).toHaveBeenCalledWith('job-1');
    expect(within(editor).queryByTestId('cover-pending')).toBeNull();
    expect(within(editor).queryAllByTestId('picture-pending')).toHaveLength(0);
    // Pictures have no alt text (LT-581), so they are read off the page itself.
    const srcs = () => [...editor.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '');
    await waitFor(() => expect(srcs()).toEqual(expect.arrayContaining([expect.stringContaining('kept-c.webp'), expect.stringContaining('a.webp')])));
    expect(toast.success).toHaveBeenCalledWith('blog.editor.picturesAdded');
    expect(updatePost).toHaveBeenCalledTimes(1);
  });

  it("does not save over the owner's own changes: the pictures join them", async () => {
    let release: (() => void) | undefined;
    vi.mocked(draftPictures).mockImplementation(() => new Promise((resolve) => {
      release = () => resolve({ done: true, pictures: { cover: 'https://api.lightor.app/api/images/tmp-ai-c.webp', 'img-0': null, 'img-1': null } });
    }));
    const editor = await writeWithPictures();
    fireEvent.change(within(editor).getByLabelText('blog.editor.title'), { target: { value: 'כותרת של בעלת העסק' } });
    await waitFor(() => expect(release).toBeDefined());
    release!();
    await waitFor(() => expect(within(editor).queryByTestId('cover-pending')).toBeNull());
    expect(within(editor).queryAllByTestId('picture-pending')).toHaveLength(0);
    expect([...editor.querySelectorAll('img')].some((img) => img.getAttribute('src')?.includes('tmp-ai-c.webp'))).toBe(true);
    expect(updatePost).not.toHaveBeenCalled();
  });

  it('lets the places go when the pictures cannot be asked about', async () => {
    vi.mocked(draftPictures).mockRejectedValue(new Error('gone'));
    const editor = await writeWithPictures();
    await waitFor(() => expect(within(editor).queryByTestId('cover-pending')).toBeNull());
    expect(within(editor).queryAllByTestId('picture-pending')).toHaveLength(0);
    expect(updatePost).not.toHaveBeenCalled();
  });

  it("counts the draft as soon as Lighty starts writing it, and gives it back when it fails (LT-615)", async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: PRO });
    vi.mocked(postIdeas).mockResolvedValue([{ title: 'איך שומרים על הלק', angle: 'טיפים לבית' }]);
    let fail: (reason: unknown) => void = () => {};
    vi.mocked(draftPost).mockImplementation(() => new Promise((_, reject) => { fail = reject; }));
    renderPage();
    fireEvent.click((await screen.findAllByRole('button', { name: /blog.lightyWrites/ }))[0]);
    const dialog = await screen.findByTestId('lighty-writes');
    expect(within(dialog).getByTestId('drafts-left').textContent).toContain('"left":7');
    fireEvent.click(await within(dialog).findByText('איך שומרים על הלק'));
    fireEvent.click(within(dialog).getByRole('button', { name: /blog.lighty.write/ }));
    await waitFor(() => expect(within(dialog).getByTestId('drafts-left').textContent).toContain('"left":6'));
    fail(new Error('no draft'));
    await waitFor(() => expect(within(dialog).getByTestId('draft-failed')).toBeInTheDocument());
    expect(within(dialog).getByTestId('drafts-left').textContent).toContain('"left":7');
  });

  it('says so when the month\'s drafts are used, and asks Lighty for nothing', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [post()], limits: { ...PRO, draftsLeft: 0 } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /blog.lightyWrites/ }));
    expect(await screen.findByTestId('drafts-used')).toBeTruthy();
    expect(postIdeas).not.toHaveBeenCalled();
  });

  it('opens a post, edits its blocks and publishes it', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [post()], limits: PRO });
    vi.mocked(getPost).mockResolvedValue(post({ body: [{ kind: 'p', text: 'פסקה ראשונה.' }] }));
    vi.mocked(updatePost).mockImplementation(async (_id, input) => post({ ...input, status: input.status ?? 'draft', publishedAt: '2026-11-07T09:00:00Z', cover: null } as Partial<Post>));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /לק ג׳ל שמחזיק/ }));
    const editor = await screen.findByTestId('post-editor');
    fireEvent.click(within(within(editor).getByTestId('add-block')).getByRole('button', { name: /blog.editor.kinds.h2/ }));
    const blocks = within(editor).getAllByTestId('post-block');
    const heading = blocks[blocks.length - 1];
    fireEvent.change(within(heading).getByRole('textbox'), { target: { value: 'כותרת משנה' } });
    fireEvent.click(within(editor).getByTestId('post-publish'));
    await waitFor(() => expect(updatePost).toHaveBeenCalledWith('p1', expect.objectContaining({
      status: 'published',
      body: [{ kind: 'p', text: 'פסקה ראשונה.' }, { kind: 'h2', text: 'כותרת משנה' }],
    })));
    expect(toast.success).toHaveBeenCalledWith('blog.editor.publishedToast');
    // Out: the post's address and the way to share it.
    expect((await within(editor).findByTestId('post-address')).textContent).toContain('https://studio.lightor.app/blog/gel-nails');
  });

  it('says what went wrong when the month\'s publications are used', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: PRO });
    vi.mocked(createPost).mockRejectedValue({ response: { status: 429, data: { code: 'POST_PUBLISH_CAP' } } });
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: /blog.iWrite/ }));
    const editor = await screen.findByTestId('post-editor');
    fireEvent.change(within(editor).getByLabelText('blog.editor.title'), { target: { value: 'פוסט' } });
    fireEvent.change(within(editor).getAllByTestId('post-block')[0].querySelector('textarea')!, { target: { value: 'פסקה.' } });
    fireEvent.click(within(editor).getByTestId('post-publish'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('blog.editor.publishCap'));
  });
});

describe('the Blog page on other plans (LT-610)', () => {
  it('is locked: what the blog is, the way to the plans, and no writing', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: { blog: false, draftsPerMonth: 0, draftsLeft: 0, publishesPerMonth: 0, publishesLeft: 0 } });
    renderPage();
    expect(await screen.findByTestId('blog-locked')).toBeTruthy();
    expect(screen.getByTestId('blog-upgrade').getAttribute('href')).toBe('/account');
    expect(screen.queryByRole('button', { name: /blog.lightyWrites/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /blog.iWrite/ })).toBeNull();
  });

  it('sells nothing in the app', async () => {
    platform.canOfferPurchases.mockReturnValue(false);
    vi.mocked(listPosts).mockResolvedValue({ posts: [], limits: { blog: false, draftsPerMonth: 0, draftsLeft: 0, publishesPerMonth: 0, publishesLeft: 0 } });
    renderPage();
    await screen.findByTestId('blog-locked');
    expect(screen.queryByTestId('blog-upgrade')).toBeNull();
  });

  it('keeps the posts from Pro, which come back with it, and lets them be deleted', async () => {
    vi.mocked(listPosts).mockResolvedValue({ posts: [post({ status: 'published' })], limits: { blog: false, draftsPerMonth: 0, draftsLeft: 0, publishesPerMonth: 0, publishesLeft: 0 } });
    vi.mocked(deletePost).mockResolvedValue();
    renderPage();
    expect((await screen.findByTestId('blog-kept')).textContent).toContain('"count":1');
    // Not opened for editing.
    expect(screen.queryByRole('button', { name: /blog.editor.title: / })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /blog.editor.delete: / }));
    fireEvent.click(await screen.findByRole('button', { name: 'blog.editor.delete' }));
    await waitFor(() => expect(deletePost).toHaveBeenCalledWith('p1'));
  });
});

describe('the helpers (LT-610)', () => {
  it("offers the site's own pictures, once each", () => {
    expect(sitePicturesOf({ components: { hero: { heroImageSrc: 'h.webp' }, portfolio: { items: [{ url: 'a.webp' }, { url: 'h.webp' }] }, about: { features: [{ image: 'f.webp' }] } }, appointmentTypes: [{ image: 's.webp' }] }))
      .toEqual(['h.webp', 'a.webp', 'f.webp', 's.webp']);
  });

  it("knows each style's looks as the site does, the owner's pick first", () => {
    expect(blogLooksOf({ stylePreset: 'festive' })).toEqual({ page: 'glass', post: 'wide', section: 'carousel' });
    expect(blogLooksOf({ stylePreset: 'festive', blogLayout: 'grid' }).page).toBe('grid');
    expect(blockLookOf('blog', undefined, { stylePreset: 'atelier' })).toBe('article');
    expect(blockLookOf('blog', 'latest', { stylePreset: 'atelier' })).toBe('latest');
  });

  it('holds the blog section from the start on a site with a blog, before the contact', () => {
    const config = { blocks: [{ id: 'h', type: 'hero' }, { id: 'c', type: 'contact' }], blog: { total: 1, latest: [{ id: 'p', slug: 's', title: 't' }] } } as never;
    expect((withBlogSection(config) as { blocks: { type: string }[] }).blocks.map((b) => b.type)).toEqual(['hero', 'blog', 'contact']);
    const none = { blocks: [{ id: 'h', type: 'hero' }] } as never;
    expect(withBlogSection(none)).toBe(none);
  });

  it("sends the site the draft as its post page reads it", () => {
    const now = new Date('2026-11-07T10:00:00Z');
    const draft = previewPostOf({ title: 'כותרת', body: [{ kind: 'p', text: Array.from({ length: 450 }, () => 'מילה').join(' ') }] }, now);
    expect(draft).toMatchObject({ id: 'preview', slug: 'preview', title: 'כותרת', minutes: 2, publishedAt: now.toISOString() });
  });
});
