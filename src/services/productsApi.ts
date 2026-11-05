import apiClient from './apiClient';
import globals from './globals';

/**
 * Products API (LT-540): 1:1 with `/api/products/*`. Primary data: every
 * function THROWS on failure and the page decides what to show. A product is
 * its own record (an order will point at it for good), not a row in the gallery.
 */

export interface ProductImage {
  url: string;
  alt?: string;
}

/** LT-588: a colour a product comes in: its name (what the visitor reads) and its swatch (#rrggbb). */
export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  _id: string;
  slug: string;
  name: string;
  summary?: string;
  description?: string;
  /** Whole minor units of the site's currency; absent = no price. */
  price?: number;
  images: ProductImage[];
  details: string[];
  category?: string;
  /** LT-588: what a visitor may pick on the site; the inquiry carries the pick. */
  colors?: ProductColor[];
  sizes?: string[];
  status: 'draft' | 'published';
  availability: 'in_stock' | 'out_of_stock';
  /** Made by a site build and not checked by the owner yet. */
  sample?: boolean;
  order: number;
}

export interface ProductLimits {
  /** How many published products the site shows: the first ones in the owner's order. */
  maxProducts: number;
  /** Whether products have addresses of their own on this plan. */
  productPages: boolean;
  /** LT-546: under the free days, when they end (ISO); the free plan then shows only the first products. */
  freeDaysUntil?: string;
  /** LT-553: under the free days, how many products the free plan then shows. */
  freeMaxProducts?: number;
}

export type ProductInput = Partial<Omit<Product, '_id' | 'slug' | 'order' | 'price'>> & { price?: number | null };

const URL = globals.productsUrl;

export const listProducts = async (): Promise<{ products: Product[]; limits: ProductLimits }> => {
  const res = await apiClient.get(URL);
  return { products: res.data.data, limits: res.data.limits };
};

export const createProduct = async (input: ProductInput & { name: string }): Promise<Product> =>
  (await apiClient.post(URL, input)).data.data;

export const createProductsFromImages = async (images: string[], fallbackName: string): Promise<Product[]> =>
  (await apiClient.post(`${URL}bulk`, { images, fallbackName })).data.data;

/** LT-541: each gallery picture becomes a product, and their section takes the gallery's place. */
export const createProductsFromGallery = async (fallbackName: string): Promise<Product[]> =>
  (await apiClient.post(`${URL}from-gallery`, { fallbackName })).data.data;

export const updateProduct = async (id: string, input: ProductInput & { sample?: false }): Promise<Product> =>
  (await apiClient.patch(`${URL}${id}`, input)).data.data;

export const deleteProduct = async (id: string): Promise<void> => {
  await apiClient.delete(`${URL}${id}`);
};

/** LT-587: a category renamed for all its products (to an existing name: the two become one; to nothing: none). */
export const renameCategory = async (from: string, to: string): Promise<number> =>
  (await apiClient.patch(`${URL}categories`, { from, to })).data.data.changed;

export const reorderProducts = async (ids: string[]): Promise<void> => {
  await apiClient.put(`${URL}order`, { ids });
};

/** "120" or "120.50" as minor units; null for an empty field, undefined for nonsense. */
export const priceToMinor = (text: string): number | null | undefined => {
  const t = text.trim().replace(',', '.');
  if (!t) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
  return Math.round(Number(t) * 100);
};

export const minorToPrice = (price: number | undefined): string =>
  typeof price === 'number' ? String(price / 100) : '';

/** LT-569: how often the products were opened on the site, the last 30 days. */
export interface ProductViews {
  total: number;
  /** Views by product id. */
  byProduct: Record<string, number>;
  /** 30 of the business's days, oldest first, today last. */
  perDay: { date: string; count: number }[];
  /** The day the views began to be counted ('YYYY-MM-DD'), or null before the first. */
  since: string | null;
}

export const fetchProductViews = async (): Promise<ProductViews> => (await apiClient.get(`${URL}views`)).data.data;
