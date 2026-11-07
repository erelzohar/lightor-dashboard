import apiClient from './apiClient';
import globals from './globals';
import { fetchMyEntitlements } from './entitlementsApi';

/**
 * LT-610 (the LT-495 plan): the blog's posts, 1:1 with `/api/posts/*`, and
 * Lighty's topics and drafts (`/api/ai/post-*`). Primary data: every function
 * THROWS on failure and the page decides what to show. Writing is Pro's: the
 * server answers 403 BLOG_NEEDS_PRO on any other plan.
 */

export type PostBlockKind = 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'quote' | 'image';

export interface PostBlock {
  kind: PostBlockKind;
  text?: string;
  items?: string[];
  url?: string;
  caption?: string;
}

export interface Post {
  _id: string;
  slug: string;
  title: string;
  summary?: string;
  category?: string;
  cover?: { url: string } | null;
  /** Absent in the list (it carries no bodies); there when one post is read. */
  body?: PostBlock[];
  status: 'draft' | 'published';
  publishedAt?: string | null;
  byLighty?: boolean;
  /** The operator hid it after a report; only the operator shows it again. */
  hiddenByAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogLimits {
  blog: boolean;
  draftsPerMonth: number;
  draftsLeft: number;
  publishesPerMonth: number;
  publishesLeft: number;
}

export interface PostInput {
  title?: string;
  summary?: string;
  category?: string;
  cover?: string | null;
  body?: PostBlock[];
  status?: 'draft' | 'published';
  slug?: string;
  byLighty?: boolean;
}

export interface PostIdea { title: string; angle: string }

export interface PostDraft {
  title: string;
  summary: string;
  category: string;
  slug: string;
  cover: string;
  body: PostBlock[];
}

const URL = globals.postsUrl;

export const listPosts = async (): Promise<{ posts: Post[]; limits: BlogLimits }> => {
  const res = await apiClient.get(URL);
  return { posts: res.data.data, limits: res.data.limits };
};

export const getPost = async (id: string): Promise<Post> => (await apiClient.get(`${URL}${id}`)).data.data;

export const createPost = async (input: PostInput & { title: string }): Promise<Post> => (await apiClient.post(URL, input)).data.data;

export const updatePost = async (id: string, input: PostInput): Promise<Post> => (await apiClient.patch(`${URL}${id}`, input)).data.data;

export const deletePost = async (id: string): Promise<void> => {
  await apiClient.delete(`${URL}${id}`);
};

/**
 * Five topics from the business and the season; `seen` keeps the next five
 * different. In the site's language (the server's: a post is for the site's
 * visitors, whatever language the dashboard is in).
 */
export const postIdeas = async (seen: string[] = []): Promise<PostIdea[]> =>
  (await apiClient.post(`${globals.aiUrl}post-ideas`, { seen })).data.data.ideas;

/** Lighty's draft from a topic and the owner's own words: one of the plan's drafts this month. */
export const draftPost = async (topic: string, words?: string): Promise<{ draft: PostDraft; draftsLeft: number }> =>
  (await apiClient.post(`${globals.aiUrl}post-draft`, { topic, ...(words?.trim() ? { words: words.trim() } : {}) })).data.data;

let blogOn: Promise<boolean> | null = null;

/**
 * Whether this account's plan has the blog (Pro), asked once a visit: the menu
 * draws its link locked on any other plan. A plan bought or ended is seen on
 * the next visit, and the Blog page itself always asks the server again.
 */
export const hasBlog = (): Promise<boolean> => {
  blogOn ??= fetchMyEntitlements().then((e) => e?.limits?.blog === true || e?.plan === 'pro').catch(() => false);
  return blogOn;
};

/** Tests and a plan change start from the server again. */
export const forgetBlogPlan = (): void => { blogOn = null; };
