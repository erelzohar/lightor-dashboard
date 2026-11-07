import type { WebConfig } from '../types';

/**
 * LT-610: the blog's looks for each style, as the site draws them (a copy of
 * lightor-front services/blogLooks.ts: keep the two the same). The owner's
 * pick - `design.blogLayout`, `design.postLayout`, the section block's
 * variant - wins.
 */
interface Looks { page: string; post: string; section: string }

const LOOKS: Record<string, Looks> = {
  crisp: { page: 'grid', post: 'classic', section: 'latest' },
  earthy: { page: 'grid', post: 'classic', section: 'latest' },
  industrial: { page: 'grid', post: 'classic', section: 'article' },
  minimal: { page: 'grid', post: 'classic', section: 'latest' },
  corporate: { page: 'grid', post: 'classic', section: 'latest' },
  warmOrganic: { page: 'grid', post: 'classic', section: 'latest' },
  bistro: { page: 'grid', post: 'classic', section: 'latest' },
  playful: { page: 'grid', post: 'wide', section: 'carousel' },
  boldStartup: { page: 'grid', post: 'wide', section: 'carousel' },
  brutalist: { page: 'grid', post: 'wide', section: 'carousel' },
  atelier: { page: 'tagged', post: 'classic', section: 'article' },
  heritage: { page: 'tagged', post: 'classic', section: 'latest' },
  gallery: { page: 'tagged', post: 'wide', section: 'article' },
  editorial: { page: 'tagged', post: 'classic', section: 'article' },
  luxe: { page: 'tagged', post: 'classic', section: 'article' },
  boutique: { page: 'tagged', post: 'classic', section: 'article' },
  electric: { page: 'glass', post: 'wide', section: 'carousel' },
  festive: { page: 'glass', post: 'wide', section: 'carousel' },
  serene: { page: 'glass', post: 'classic', section: 'latest' },
  underground: { page: 'glass', post: 'wide', section: 'carousel' },
};
const PLAIN: Looks = { page: 'grid', post: 'classic', section: 'latest' };

export const BLOG_PAGE_VALUES = ['grid', 'tagged', 'glass'];
export const POST_PAGE_VALUES = ['classic', 'wide'];
export const BLOG_SECTION_VALUES = ['latest', 'article', 'carousel'];

export const blogLooksOf = (design: Record<string, unknown> | null | undefined): Looks => {
  const own = (typeof design?.stylePreset === 'string' && LOOKS[design.stylePreset]) || PLAIN;
  const page = typeof design?.blogLayout === 'string' && BLOG_PAGE_VALUES.includes(design.blogLayout) ? design.blogLayout : own.page;
  const post = typeof design?.postLayout === 'string' && POST_PAGE_VALUES.includes(design.postLayout) ? design.postLayout : own.post;
  return { page, post, section: own.section };
};

/** Where the section goes on a page that has none: before the way to get in touch (as the site draws it). */
const BEFORE = new Set(['contact', 'social', 'mapStrip', 'footer']);

/**
 * A page with a blog and no section for it shows the section before its
 * contact block (the site draws it so); the editor holds it as a block from
 * the start, so the owner can move or hide it, and a save stores it.
 */
export const withBlogSection = (config: WebConfig): WebConfig => {
  const blocks = config.blocks ?? [];
  if (!config.blog?.latest?.length || !blocks.length || blocks.some((b) => b.type === 'blog')) return config;
  const at = blocks.findIndex((b) => BEFORE.has(b.type));
  const block = { id: 'blog', type: 'blog' };
  return { ...config, blocks: at === -1 ? [...blocks, block] : [...blocks.slice(0, at), block, ...blocks.slice(at)] };
};
