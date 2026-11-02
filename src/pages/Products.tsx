import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EyeOff, ExternalLink, GripVertical, ImagePlus, Images, Loader2, Plus, ShoppingBag, Sparkles, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AxiosError } from 'axios';
import {
  DndContext, MeasuringStrategy, MouseSensor, KeyboardSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { useConfirm } from '../hooks/useConfirm';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { uploadImage } from '../services/imagesApi';
import { aiService } from '../services/aiApi';
import globals from '../services/globals';
import {
  createProduct, createProductsFromGallery, createProductsFromImages, deleteProduct, listProducts, minorToPrice, priceToMinor, reorderProducts, updateProduct,
  type Product, type ProductInput, type ProductLimits,
} from '../services/productsApi';
import { sortableA11y } from '../utils/sortableA11y';
import { currencySymbol } from '../utils/currency';
import { siteUrlOf } from '../utils/siteUrl';
import { isAiBusy } from '../lib/aiErrors';
import { canOfferPurchases } from '../lib/platform';
import ToggleSwitch from '../components/ui/ToggleSwitch';
import { pop } from '../components/ui/pop-button';

const MAX_PICTURES = 6;
const MAX_DETAILS = 6;

const imageSrc = (url: string | undefined): string => {
  if (!url) return '';
  return /^https?:\/\//.test(url) ? url : `${globals.imagesUrl}${url}`;
};

const compressed = (file: File): Promise<File> =>
  imageCompression(file, { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true, alwaysKeepResolution: true });

const field = 'w-full rounded-xl border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-gray-900 dark:text-white outline-none focus:border-primary';
const label = 'mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300';

interface Draft {
  name: string;
  summary: string;
  description: string;
  price: string;
  category: string;
  details: string[];
  images: { url: string; alt?: string }[];
  published: boolean;
  soldOut: boolean;
}

const draftOf = (p: Product | null): Draft => ({
  name: p?.name ?? '',
  summary: p?.summary ?? '',
  description: p?.description ?? '',
  price: minorToPrice(p?.price),
  category: p?.category ?? '',
  details: p?.details ?? [],
  images: p?.images ?? [],
  published: (p?.status ?? 'published') === 'published',
  soldOut: p?.availability === 'out_of_stock',
});

/** One product's form: the pictures, what it is, what it costs, whether it shows. */
const ProductEditor: React.FC<{
  product: Product | null;
  language: string;
  categories: string[];
  /** LT-546: as many published products come before it as the plan shows, so on the site it stays hidden. */
  hiddenByPlan: boolean;
  onClose: () => void;
  onSaved: (product: Product, created: boolean) => void;
  onDeleted: (id: string) => void;
}> = ({ product, language, categories, hiddenByPlan, onClose, onSaved, onDeleted }) => {
  const { t } = useTranslation();
  const titleId = useId();
  const { confirm, dialog } = useConfirm();
  const [draft, setDraft] = useState<Draft>(() => draftOf(product));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [newDetail, setNewDetail] = useState('');
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addPictures = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])].slice(0, MAX_PICTURES - draft.images.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { imageName } = await uploadImage(await compressed(file), 'photo');
        setDraft((d) => ({ ...d, images: [...d.images, { url: imageName }] }));
      }
    } catch {
      toast.error(t('products.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  // Lighty reads the first picture; nothing is stored until the owner saves.
  const fillFromPicture = async () => {
    const image = draft.images[0]?.url;
    if (!image) return;
    setDrafting(true);
    try {
      const filled = await aiService.draftProduct(image, language);
      setDraft((d) => ({
        ...d,
        name: d.name.trim() ? d.name : filled.name,
        summary: d.summary.trim() ? d.summary : filled.summary,
        description: d.description.trim() ? d.description : filled.description,
        category: d.category.trim() ? d.category : filled.category,
      }));
    } catch (err) {
      const status = (err as AxiosError)?.response?.status;
      toast.error(t(isAiBusy(err) ? 'common.aiBusy' : status === 429 ? 'products.draftBudget' : 'products.draftFailed'));
    } finally {
      setDrafting(false);
    }
  };

  const save = async () => {
    const price = priceToMinor(draft.price);
    if (!draft.name.trim()) { toast.error(t('products.nameRequired')); return; }
    if (price === undefined) { toast.error(t('products.priceInvalid')); return; }
    const input: ProductInput = {
      name: draft.name.trim(),
      summary: draft.summary.trim(),
      description: draft.description.trim(),
      category: draft.category.trim(),
      details: draft.details,
      images: draft.images,
      price,
      status: draft.published ? 'published' : 'draft',
      availability: draft.soldOut ? 'out_of_stock' : 'in_stock',
    };
    setSaving(true);
    try {
      if (product) onSaved(await updateProduct(product._id, { ...input, sample: false }), false);
      else onSaved(await createProduct({ ...input, name: input.name as string }), true);
    } catch (err) {
      const code = (err as AxiosError<{ code?: string }>)?.response?.data?.code;
      toast.error(t(code === 'PRODUCT_CAP_REACHED' ? 'products.capReached' : 'products.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!product) return;
    const ok = await confirm({
      title: t('products.deleteDialog.title'),
      message: t('products.deleteDialog.body', { name: product.name }),
      confirmLabel: t('products.deleteDialog.confirm'),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProduct(product._id);
      onDeleted(product._id);
    } catch {
      toast.error(t('products.saveError'));
    }
  };

  const addDetail = () => {
    const text = newDetail.trim();
    if (!text || draft.details.length >= MAX_DETAILS) return;
    set('details', [...draft.details, text]);
    setNewDetail('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="product-editor"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-2xl bg-white dark:bg-slate-900 sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 px-5 py-4">
          <h2 id={titleId} className="text-lg font-bold text-gray-900 dark:text-white">{product ? t('products.editTitle') : t('products.newTitle')}</h2>
          <button type="button" onClick={onClose} aria-label={t('products.close')} className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div>
            <p className={label}>{t('products.pictures')}</p>
            <div className="flex flex-wrap gap-2">
              {draft.images.map((image, i) => (
                <div key={image.url} className="relative h-20 w-20 overflow-hidden rounded-xl bg-gray-100 dark:bg-slate-800">
                  <img src={imageSrc(image.url)} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => set('images', draft.images.filter((_, k) => k !== i))}
                    aria-label={t('products.removePicture')}
                    className="absolute end-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {draft.images.length < MAX_PICTURES && (
                <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-500 hover:border-primary hover:text-primary">
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                  <span className="sr-only">{t('products.addPicture')}</span>
                  <input type="file" accept="image/*" multiple className="sr-only" onChange={addPictures} disabled={uploading} />
                </label>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{t('products.picturesHint')}</p>
            {draft.images.length > 0 && (
              // LT-542 (Erel): a button, not a line of purple text.
              <button
                type="button"
                onClick={fillFromPicture}
                disabled={drafting}
                className={`mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-60 ${pop('default')}`}
                data-testid="fill-from-picture"
              >
                {drafting ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Sparkles className="h-4 w-4 text-primary" />}
                {t('products.fillFromPicture')}
              </button>
            )}
          </div>

          <div>
            <label className={label} htmlFor="product-name">{t('products.name')}</label>
            <input id="product-name" className={field} maxLength={120} value={draft.name} onChange={(e) => set('name', e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="product-price">{t('products.price')}</label>
              <input id="product-price" className={field} inputMode="decimal" dir="ltr" value={draft.price} onChange={(e) => set('price', e.target.value)} placeholder={t('products.pricePlaceholder')} />
            </div>
            <div>
              <label className={label} htmlFor="product-category">{t('products.category')}</label>
              <input id="product-category" className={field} maxLength={40} list="product-categories" value={draft.category} onChange={(e) => set('category', e.target.value)} />
              <datalist id="product-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
          </div>

          <div>
            <label className={label} htmlFor="product-summary">{t('products.summary')}</label>
            <input id="product-summary" className={field} maxLength={160} value={draft.summary} onChange={(e) => set('summary', e.target.value)} />
          </div>

          <div>
            <label className={label} htmlFor="product-description">{t('products.fieldDescription')}</label>
            <textarea id="product-description" className={field} rows={4} maxLength={3000} value={draft.description} onChange={(e) => set('description', e.target.value)} />
          </div>

          <div>
            <label className={label} htmlFor="product-detail">{t('products.details')}</label>
            {draft.details.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-1.5">
                {draft.details.map((detail, i) => (
                  <li key={detail} className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-sm text-gray-700 dark:text-slate-200">
                    {detail}
                    <button type="button" aria-label={t('products.removeDetail')} onClick={() => set('details', draft.details.filter((_, k) => k !== i))}><X className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
            {draft.details.length < MAX_DETAILS && (
              <input
                id="product-detail"
                className={field}
                maxLength={60}
                value={newDetail}
                placeholder={t('products.detailPlaceholder')}
                onChange={(e) => setNewDetail(e.target.value)}
                onBlur={addDetail}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDetail(); } }}
              />
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('products.published')}</p>
              <ToggleSwitch checked={draft.published} onChange={(on) => set('published', on)} ariaLabel={t('products.published')} />
            </div>
            {hiddenByPlan && draft.published && (
              <p className="text-xs text-amber-700 dark:text-amber-300" data-testid="product-hidden-note">{t('products.hiddenNote')}</p>
            )}
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{t('products.soldOut')}</p>
              <ToggleSwitch checked={draft.soldOut} onChange={(on) => set('soldOut', on)} ariaLabel={t('products.soldOut')} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 dark:border-slate-800 px-5 py-3">
          {product ? (
            <button type="button" onClick={remove} className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
              <Trash2 className="h-4 w-4" /> {t('products.delete')}
            </button>
          ) : <span />}
          <button type="button" onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('products.save')}
          </button>
        </div>
      </div>
      {dialog}
    </div>,
    document.body,
  );
};

/** LT-546: past the plan, which products the site shows and which it hides. */
type SiteState = 'shown' | 'hidden';

const SortableProduct: React.FC<{ product: Product; currency?: string; siteState?: SiteState; onOpen: (p: Product) => void }> = ({ product, currency, siteState, onOpen }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: product._id });
  const cover = product.images[0]?.url;
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      <button type="button" onClick={() => onOpen(product)} className="block w-full text-start" data-testid="product-card">
        <div className="relative aspect-square bg-gray-100 dark:bg-slate-800">
          {cover ? <img src={imageSrc(cover)} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-gray-400"><ImagePlus className="h-8 w-8" /></div>}
          <div className="absolute start-2 top-2 flex flex-wrap gap-1">
            {siteState === 'shown' && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white" data-testid="badge-shown">{t('products.badge.shown')}</span>}
            {siteState === 'hidden' && <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white" data-testid="badge-hidden">{t('products.badge.hidden')}</span>}
            {product.status === 'draft' && <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{t('products.badge.draft')}</span>}
            {product.availability === 'out_of_stock' && <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">{t('products.soldOut')}</span>}
            {product.sample && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">{t('products.badge.sample')}</span>}
          </div>
        </div>
        <div className="p-3">
          <p className="font-medium text-gray-900 dark:text-white break-words">{product.name}</p>
          <p className="text-sm text-gray-500 dark:text-slate-400" dir="ltr">{typeof product.price === 'number' ? `${currencySymbol(currency)}${minorToPrice(product.price)}` : '\u00a0'}</p>
        </div>
      </button>
      <button
        type="button"
        aria-label={t('products.reorder', { name: product.name })}
        className="absolute end-2 top-2 cursor-grab touch-none rounded-lg bg-white/90 dark:bg-slate-900/90 p-1.5 text-gray-600 dark:text-slate-300 shadow active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
    </div>
  );
};

/**
 * LT-540: the site's products. They take the gallery's place in the menu and on
 * the page; each is a record of its own. Many pictures at once make a draft each,
 * since nobody types thirty products by hand, and Lighty can fill one in from
 * its picture.
 */
const Products: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { auth } = useAuth();
  const dispatch = useAppDispatch();
  const webConfig = useAppSelector((state) => state.webConfig.data);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [limits, setLimits] = useState<ProductLimits | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingShown, setSavingShown] = useState(false);
  const manyRef = useRef<HTMLInputElement>(null);
  const { confirm: confirmConvert, dialog: convertDialog } = useConfirm();

  const load = useCallback(async () => {
    try {
      const { products: list, limits: plan } = await listProducts();
      setProducts(list);
      setLimits(plan);
    } catch {
      toast.error(t('products.loadFailed'));
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { document.title = t('products.title'); }, [t]);

  const refreshSite = useCallback(() => {
    if (auth?.user?.webConfig_id) void dispatch(fetchWebConfig(auth.user.webConfig_id));
  }, [auth?.user?.webConfig_id, dispatch]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!products || !over || active.id === over.id) return;
    const from = products.findIndex((p) => p._id === active.id);
    const to = products.findIndex((p) => p._id === over.id);
    const next = arrayMove(products, from, to);
    setProducts(next);
    try {
      await reorderProducts(next.map((p) => p._id));
    } catch {
      setProducts(products);
      toast.error(t('products.saveError'));
    }
  };

  const room = limits ? Math.max(0, limits.maxProducts - (products?.length ?? 0)) : 0;

  const addMany = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    if (files.length > room) toast.error(t('products.tooMany', { count: room }));
    const taken = files.slice(0, room);
    if (!taken.length) return;
    setUploading(true);
    try {
      const names: string[] = [];
      for (const file of taken) names.push((await uploadImage(await compressed(file), 'photo')).imageName);
      const created = await createProductsFromImages(names, t('products.newName'));
      setProducts((list) => [...(list ?? []), ...created]);
      toast.success(t('products.draftsMade', { count: created.length }));
    } catch {
      toast.error(t('products.uploadError'));
    } finally {
      setUploading(false);
    }
  };

  const onSaved = (product: Product, created: boolean) => {
    setProducts((list) => (created ? [...(list ?? []), product] : (list ?? []).map((p) => (p._id === product._id ? product : p))));
    setEditing(null);
    toast.success(t('products.saved'));
    refreshSite();
  };

  const onDeleted = (id: string) => {
    setProducts((list) => (list ?? []).filter((p) => p._id !== id));
    setEditing(null);
    refreshSite();
  };

  // LT-541: a gallery that is really a catalogue turns into one in a tap.
  const galleryCount = webConfig?.components?.portfolio?.items?.length ?? 0;
  const convertGallery = async () => {
    const ok = await confirmConvert({
      title: t('products.fromGallery.title'),
      message: t('products.fromGallery.body', { count: Math.min(galleryCount, room) }),
      confirmLabel: t('products.fromGallery.confirm'),
    });
    if (!ok) return;
    setUploading(true);
    try {
      const created = await createProductsFromGallery(t('products.newName'));
      setProducts((list) => [...(list ?? []), ...created]);
      toast.success(t('products.fromGallery.done', { count: created.length }));
      refreshSite();
    } catch {
      toast.error(t('products.saveError'));
    } finally {
      setUploading(false);
    }
  };

  // LT-558: the owner's switch, as the gallery has; off, the site shows no products anywhere.
  const shownOnSite = webConfig?.components?.products?.visible !== false;
  const setShownOnSite = async (visible: boolean) => {
    if (!webConfig) return;
    setSavingShown(true);
    try {
      const res = await dispatch(updateWebConfig({
        _id: webConfig._id,
        components: { ...webConfig.components, products: { ...webConfig.components.products, visible } },
      } as Parameters<typeof updateWebConfig>[0]));
      if (updateWebConfig.rejected.match(res)) throw new Error('Update rejected');
      toast.success(t(visible ? 'products.visibility.savedShown' : 'products.visibility.savedHidden'));
      refreshSite();
    } catch {
      toast.error(t('products.saveError'));
    } finally {
      setSavingShown(false);
    }
  };

  const siteUrl = siteUrlOf(webConfig?.subDomain);
  const categories = [...new Set((products ?? []).map((p) => p.category).filter((c): c is string => !!c))];
  const full = limits !== null && room === 0;
  // LT-546: the site shows the first published products, as many as the plan
  // takes (visibleProducts in the API); past them the rest are kept, hidden.
  const overPlan = limits !== null && (products ?? []).filter((p) => p.status === 'published').length > limits.maxProducts;
  /** Published, this one would be past the plan's number: as many published products come before it. */
  const hiddenOnSite = (id: string): boolean => {
    if (!limits || !products) return false;
    const at = products.findIndex((p) => p._id === id);
    return products.slice(0, at).filter((p) => p.status === 'published').length >= limits.maxProducts;
  };
  const siteStateOf = (p: Product): SiteState | undefined =>
    overPlan && p.status === 'published' ? (hiddenOnSite(p._id) ? 'hidden' : 'shown') : undefined;
  const dateLocale =
    i18n.language === 'he' ? 'he-IL' : i18n.language === 'ar' ? 'ar' : i18n.language === 'fr' ? 'fr' : i18n.language === 'es' ? 'es' : 'en-GB';
  const freeDaysEnd = limits?.freeDaysUntil ? new Date(limits.freeDaysUntil).toLocaleDateString(dateLocale) : null;
  const used = products?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-7xl p-6 md:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-3">
            <ShoppingBag className="h-6 w-6 shrink-0 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{t('products.title')}</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('products.description')}</p>
          {limits && (
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300" data-testid="products-count">
              {used > limits.maxProducts ? t('products.countOnly', { used }) : t('products.count', { used, max: limits.maxProducts })}
              {!limits.productPages && <span className="ms-1">{t('products.onePageNote')}</span>}
            </p>
          )}
          {freeDaysEnd && limits?.freeMaxProducts !== undefined && (
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300" data-testid="products-after-trial">{t('products.afterFreeDays', { date: freeDaysEnd, max: limits.freeMaxProducts })}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {siteUrl && (products?.length ?? 0) > 0 && (
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-slate-200">
              <ExternalLink className="h-4 w-4" /> {t('products.seeOnSite')}
            </a>
          )}
          <button type="button" data-tour="add-products" disabled={full || uploading} onClick={() => manyRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-medium text-primary disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
            {t('products.addMany')}
          </button>
          <button type="button" data-tour="add-product" disabled={full} onClick={() => setEditing('new')} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            <Plus className="h-4 w-4" /> {t('products.add')}
          </button>
          <input ref={manyRef} type="file" accept="image/*" multiple className="sr-only" onChange={addMany} aria-label={t('products.addMany')} />
        </div>
      </div>

      {webConfig?.catalog && (products?.length ?? 0) > 0 && (
        <div
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 ${shownOnSite ? 'border-gray-200 dark:border-slate-700' : 'border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'}`}
          data-testid="products-on-site"
        >
          <div className="flex min-w-0 items-start gap-2">
            {!shownOnSite && <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />}
            <div className="min-w-0">
              <p className={`text-sm font-medium ${shownOnSite ? 'text-gray-900 dark:text-white' : 'text-amber-800 dark:text-amber-200'}`}>
                {t(shownOnSite ? 'products.visibility.shown' : 'products.visibility.hidden')}
              </p>
              {!shownOnSite && <p className="text-sm text-amber-800/80 dark:text-amber-200/80">{t('products.visibility.hiddenBody')}</p>}
            </div>
          </div>
          <ToggleSwitch checked={shownOnSite} onChange={(v) => void setShownOnSite(v)} disabled={savingShown} label={t('products.visibility.label')} />
        </div>
      )}

      {galleryCount > 0 && !webConfig?.catalog && room > 0 && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3" data-testid="from-gallery">
          <p className="min-w-0 text-sm text-gray-700 dark:text-slate-200">{t('products.fromGallery.hint', { count: galleryCount })}</p>
          <button type="button" onClick={convertGallery} disabled={uploading} className="shrink-0 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {t('products.fromGallery.action')}
          </button>
        </div>
      )}

      {overPlan ? (
        <p className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" data-testid="products-over-plan">
          {limits.maxProducts === 1 ? t('products.overFree') : t('products.overPlan', { max: limits.maxProducts })}
          {/* The app states the fact and sells nothing (LT-130). */}
          {canOfferPurchases() && (
            <Link to="/account" className="ms-1 font-medium underline">{t('products.upgradeBack')}</Link>
          )}
        </p>
      ) : full && (
        <p className="mb-6 rounded-xl bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" data-testid="products-full">{t('products.capReached')}</p>
      )}

      {products === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 px-6 py-16 text-center" data-tour="products" data-testid="products-empty">
          <ShoppingBag className="mx-auto mb-3 h-10 w-10 text-gray-400" />
          <p className="font-medium text-gray-900 dark:text-white">{t('products.empty.title')}</p>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">{t('products.empty.body')}</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={sortableA11y(t, (id) => products.find((p) => p._id === id)?.name ?? '')}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        >
          <SortableContext items={products.map((p) => p._id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5" data-tour="products" data-testid="products-grid">
              {products.map((product) => <SortableProduct key={product._id} product={product} currency={webConfig?.currency} siteState={siteStateOf(product)} onOpen={setEditing} />)}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing !== null && (
        <ProductEditor
          product={editing === 'new' ? null : editing}
          language={webConfig?.defaultLanguage || 'he'}
          categories={categories}
          hiddenByPlan={editing !== 'new' && hiddenOnSite(editing._id)}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
      {convertDialog}
    </div>
  );
};

export default Products;
