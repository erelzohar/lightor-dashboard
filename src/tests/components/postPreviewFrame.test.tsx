import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostPreview, { type PreviewPost } from '../../components/blog/PostPreview';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

/**
 * LT-661: a post's preview is the site in a frame, so it stays on the site's
 * Lightor address whatever domain the owner connected - the edge leaves a
 * framed request there, and the domain cannot be framed by the dashboard.
 */
describe("a post's preview frame", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const post: PreviewPost = { slug: 'gel-nails', title: 'Gel nails', body: [] };
  const frame = () => screen.getByTitle('blog.preview.title') as HTMLIFrameElement;

  it.each([
    ['no domain', {}],
    ["the owner's own domain", { customHost: 'www.studio-dana.co.il' }],
  ])('in production is the Lightor address with %s', (_name, over) => {
    vi.stubEnv('PROD', true);
    render(<PostPreview post={post} config={{ subDomain: 'studio', ...over }} onClose={() => undefined} />);
    expect(frame().src).toBe('https://studio.lightor.app/blog/gel-nails');
  });

  it('never frames the domain in development either', () => {
    render(<PostPreview post={post} config={{ subDomain: 'studio', customHost: 'www.studio-dana.co.il' }} onClose={() => undefined} />);
    expect(new URL(frame().src).hostname).not.toBe('www.studio-dana.co.il');
  });
});
