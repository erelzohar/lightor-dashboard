import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ArrowLeft, Check, Loader2, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Album/photo picker for the Facebook portfolio import (LT-010).
 *
 * Browsing happens entirely in the browser against the Graph API with the
 * short-lived token the user just granted — the token never reaches our
 * backend and is not stored anywhere. Only the CDN URLs of the photos the
 * user actually picked are sent up, where the server fetches the bytes
 * (Meta's CDN sends no CORS headers, so the browser could not) and runs
 * them through the normal upload pipeline.
 */

const GRAPH = 'https://graph.facebook.com/v19.0';

interface FbAlbum {
  id: string;
  name: string;
  count?: number;
  cover_photo?: { picture?: string };
}

interface FbPhoto {
  id: string;
  /** Thumbnail for the grid. */
  picture: string;
  /** Renditions, largest first — [0].source is what gets imported. */
  images?: { source: string; width: number; height: number }[];
}

interface Props {
  accessToken: string;
  /** How many photos may still be added before the portfolio cap. */
  remainingSlots: number;
  onClose: () => void;
  /** Called with the picked photos' full-size CDN URLs. */
  onImport: (urls: string[]) => Promise<void>;
}

const FacebookPhotoPicker: React.FC<Props> = ({ accessToken, remainingSlots, onClose, onImport }) => {
  const { t } = useTranslation();
  const [albums, setAlbums] = useState<FbAlbum[] | null>(null);
  const [album, setAlbum] = useState<FbAlbum | null>(null);
  const [photos, setPhotos] = useState<FbPhoto[]>([]);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [failed, setFailed] = useState(false);

  const graphGet = async (url: string) => {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json;
  };

  useEffect(() => {
    graphGet(`${GRAPH}/me/albums?fields=name,count,cover_photo{picture}&limit=100&access_token=${accessToken}`)
      .then((json) => setAlbums(json.data ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const openAlbum = async (a: FbAlbum) => {
    setAlbum(a);
    setPhotos([]);
    setLoading(true);
    try {
      const json = await graphGet(`${GRAPH}/${a.id}/photos?fields=picture,images&limit=50&access_token=${accessToken}`);
      setPhotos(json.data ?? []);
      setNextPage(json.paging?.next ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!nextPage) return;
    setLoading(true);
    try {
      const json = await graphGet(nextPage);
      setPhotos((prev) => [...prev, ...(json.data ?? [])]);
      setNextPage(json.paging?.next ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (photo: FbPhoto) => {
    const source = photo.images?.[0]?.source;
    if (!source) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(photo.id)) next.delete(photo.id);
      else if (next.size < remainingSlots) next.set(photo.id, source);
      return next;
    });
  };

  const handleImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    try {
      await onImport([...selected.values()]);
      onClose();
    } finally {
      setImporting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl bg-light-surface dark:bg-dark-surface border border-gray-200 dark:border-gray-700 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {album && (
              <button
                onClick={() => { setAlbum(null); setNextPage(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 rtl:rotate-180"
                aria-label={t('fbImport.back')}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {album ? album.name : t('fbImport.pickAlbum')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('fbImport.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
              <ImageOff size={32} />
              <p className="text-sm">{t('fbImport.loadFailed')}</p>
            </div>
          ) : !album ? (
            albums === null ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : albums.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10">{t('fbImport.noAlbums')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {albums.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => openAlbum(a)}
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-start"
                    >
                      {a.cover_photo?.picture ? (
                        <img src={a.cover_photo.picture} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">{a.name}</span>
                      {typeof a.count === 'number' && (
                        <span className="text-xs text-gray-500">{a.count}</span>
                      )}
                      <ChevronRight size={16} className="text-gray-400 rtl:rotate-180" />
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {photos.map((photo) => {
                  const isPicked = selected.has(photo.id);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggle(photo)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isPicked ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={photo.picture} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {isPicked && (
                        <span className="absolute top-1 end-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check size={13} className="text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>}
              {nextPage && !loading && (
                <button onClick={loadMore} className="w-full mt-3 py-2 text-sm text-primary hover:underline">
                  {t('fbImport.loadMore')}
                </button>
              )}
            </>
          )}
          {!album && loading && albums === null && null}
        </div>

        {/* Footer */}
        {album && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">
              {t('fbImport.selectedCount', { count: selected.size, max: remainingSlots })}
            </span>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? t('fbImport.importing') : t('fbImport.importSelected')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default FacebookPhotoPicker;
