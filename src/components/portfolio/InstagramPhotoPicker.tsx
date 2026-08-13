import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ArrowLeft, Check, Loader2, ImageOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Media picker for the Instagram portfolio import (LT-042).
 *
 * Same architecture and security posture as FacebookPhotoPicker (LT-010):
 * browsing happens entirely in the browser against the Graph API with the
 * short-lived token the user just granted — the token never reaches our
 * backend and is not stored anywhere. Only the CDN URLs of the picked photos
 * are sent up, through the same /images/import-from-url pipeline.
 *
 * The route to the media is Facebook Login's: /me/accounts lists the pages
 * the user manages, each page may carry a linked instagram_business_account,
 * and that account's /media is readable with instagram_basic. Meta retired
 * API access for personal Instagram accounts (Basic Display, Dec 2024), so a
 * professional account linked to a Facebook page is a hard requirement — the
 * empty state says so rather than presenting it as an error.
 */

const GRAPH = 'https://graph.facebook.com/v19.0';

interface IgAccount {
  /** IG user id — the node /media hangs off. */
  id: string;
  username?: string;
  profile_picture_url?: string;
  media_count?: number;
}

interface IgMediaChild {
  id: string;
  media_type: 'IMAGE' | 'VIDEO';
  media_url?: string;
}

interface IgMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  media_url?: string;
  /** Present on VIDEO only; not imported, videos are skipped. */
  thumbnail_url?: string;
  children?: { data: IgMediaChild[] };
}

/** A single selectable tile: a plain image post or one photo of a carousel. */
interface Tile {
  id: string;
  url: string;
}

/** Flatten a media page into image tiles; videos are dropped. */
const toTiles = (media: IgMedia[]): Tile[] =>
  media.flatMap((m) => {
    if (m.media_type === 'IMAGE' && m.media_url) return [{ id: m.id, url: m.media_url }];
    if (m.media_type === 'CAROUSEL_ALBUM' && m.children)
      return m.children.data
        .filter((c) => c.media_type === 'IMAGE' && c.media_url)
        .map((c) => ({ id: c.id, url: c.media_url! }));
    return [];
  });

interface Props {
  accessToken: string;
  /** How many photos may still be added before the portfolio cap. */
  remainingSlots: number;
  onClose: () => void;
  /** Called with the picked photos' full-size CDN URLs. */
  onImport: (urls: string[]) => Promise<void>;
}

const MEDIA_FIELDS = 'id,media_type,media_url,thumbnail_url,children{media_url,media_type}';

const InstagramPhotoPicker: React.FC<Props> = ({ accessToken, remainingSlots, onClose, onImport }) => {
  const { t } = useTranslation();
  const [accounts, setAccounts] = useState<IgAccount[] | null>(null);
  const [account, setAccount] = useState<IgAccount | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
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

  const openAccount = async (a: IgAccount) => {
    setAccount(a);
    setTiles([]);
    setLoading(true);
    try {
      const json = await graphGet(`${GRAPH}/${a.id}/media?fields=${MEDIA_FIELDS}&limit=50&access_token=${accessToken}`);
      setTiles(toTiles(json.data ?? []));
      setNextPage(json.paging?.next ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    graphGet(`${GRAPH}/me/accounts?fields=name,instagram_business_account{id,username,profile_picture_url,media_count}&limit=100&access_token=${accessToken}`)
      .then((json) => {
        const igAccounts: IgAccount[] = (json.data ?? [])
          .map((page: { instagram_business_account?: IgAccount }) => page.instagram_business_account)
          .filter(Boolean);
        setAccounts(igAccounts);
        // One linked account is the overwhelmingly common case — skip the list.
        if (igAccounts.length === 1) openAccount(igAccounts[0]);
        else setLoading(false);
      })
      .catch(() => {
        setFailed(true);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const loadMore = async () => {
    if (!nextPage) return;
    setLoading(true);
    try {
      const json = await graphGet(nextPage);
      setTiles((prev) => [...prev, ...toTiles(json.data ?? [])]);
      setNextPage(json.paging?.next ?? null);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const toggle = (tile: Tile) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(tile.id)) next.delete(tile.id);
      else if (next.size < remainingSlots) next.set(tile.id, tile.url);
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
            {account && accounts && accounts.length > 1 && (
              <button
                onClick={() => { setAccount(null); setNextPage(null); }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 rtl:rotate-180"
                aria-label={t('igImport.back')}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {account ? `@${account.username ?? ''}` : t('igImport.pickAccount')}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" aria-label={t('igImport.close')}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4">
          {failed ? (
            <div className="flex flex-col items-center gap-2 py-10 text-gray-500">
              <ImageOff size={32} />
              <p className="text-sm">{t('igImport.loadFailed')}</p>
            </div>
          ) : !account ? (
            accounts === null ? (
              <div className="flex justify-center py-10"><Loader2 className="animate-spin text-primary" /></div>
            ) : accounts.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-10 whitespace-pre-line">{t('igImport.noAccounts')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <button
                      onClick={() => openAccount(a)}
                      className="w-full flex items-center gap-3 py-3 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-start"
                    >
                      {a.profile_picture_url ? (
                        <img src={a.profile_picture_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                      )}
                      <span className="flex-1 text-sm font-medium text-gray-900 dark:text-white">@{a.username}</span>
                      {typeof a.media_count === 'number' && (
                        <span className="text-xs text-gray-500">{a.media_count}</span>
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
                {tiles.map((tile) => {
                  const isPicked = selected.has(tile.id);
                  return (
                    <button
                      key={tile.id}
                      onClick={() => toggle(tile)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        isPicked ? 'border-primary ring-2 ring-primary/40' : 'border-transparent hover:border-gray-300'
                      }`}
                    >
                      <img src={tile.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      {isPicked && (
                        <span className="absolute top-1 end-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check size={13} className="text-white" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {!loading && tiles.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-10">{t('igImport.noPhotos')}</p>
              )}
              {loading && <div className="flex justify-center py-4"><Loader2 className="animate-spin text-primary" /></div>}
              {nextPage && !loading && (
                <button onClick={loadMore} className="w-full mt-3 py-2 text-sm text-primary hover:underline">
                  {t('igImport.loadMore')}
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {account && (
          <div className="flex items-center justify-between gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500">
              {t('igImport.selectedCount', { count: selected.size, max: remainingSlots })}
            </span>
            <button
              onClick={handleImport}
              disabled={selected.size === 0 || importing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              {importing && <Loader2 size={15} className="animate-spin" />}
              {importing ? t('igImport.importing') : t('igImport.importSelected')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default InstagramPhotoPicker;
