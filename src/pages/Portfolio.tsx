import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Image as ImageIcon, Plus, Sparkles, Facebook, Instagram } from 'lucide-react';
import toast from 'react-hot-toast';
import imageCompression from 'browser-image-compression';

import {
    DndContext,
    closestCenter,
    MouseSensor,
    TouchSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    MeasuringStrategy,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
} from '@dnd-kit/sortable';

import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import FacebookLoginPkg from '@greatsumini/react-facebook-login';

// CJS/ESM interop: Vite may expose the whole module object as the default
const FacebookLogin =
    (FacebookLoginPkg as { default?: typeof FacebookLoginPkg }).default ?? FacebookLoginPkg;
import { uploadImage, importImageFromUrl } from '../services/imagesApi';
import { exchangeInstagramCode } from '../services/instagramApi';
import FacebookPhotoPicker from '../components/portfolio/FacebookPhotoPicker';
import InstagramPhotoPicker from '../components/portfolio/InstagramPhotoPicker';
import SortableImageItem from '../components/portfolio/SortableImageItem';
import { PortfolioItem } from '../types';
import { useTranslation } from 'react-i18next';

/**
 * Instagram Login (LT-043) is env-gated: with the Instagram app id present
 * the tile opens Instagram's own OAuth dialog (no Facebook page needed);
 * without it the tile falls back to the Facebook-linked route (LT-042), so
 * the feature keeps working while the Meta side is unconfigured.
 */
const IG_APP_ID = (import.meta.env.VITE_INSTAGRAM_APP_ID as string | undefined) || '';

const GLASS: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
};

const Portfolio: React.FC = () => {
    const { t } = useTranslation();
    const { auth } = useAuth();
    const dispatch = useAppDispatch();

    const webConfig = useAppSelector(state => state.webConfig.data);
    const webConfigLoading = useAppSelector(state => state.webConfig.loading);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSavingVisibility, setIsSavingVisibility] = useState(false);
    const [items, setItems] = useState(webConfig?.components?.portfolio?.items || []);
    const [isVisible, setIsVisible] = useState(webConfig?.components?.portfolio?.visible ?? true);
    const [fbToken, setFbToken] = useState<string | null>(null);
    const [igAuth, setIgAuth] = useState<{ token: string; source: 'facebook' | 'instagram' } | null>(null);
    /** CSRF state for the in-flight Instagram Login popup, if any. */
    const igStateRef = useRef<string | null>(null);

    // Relay target for the Instagram Login popup (see InstagramCallback).
    useEffect(() => {
        const onMessage = async (e: MessageEvent) => {
            if (e.origin !== window.location.origin) return;
            const d = e.data as { type?: string; code?: string; state?: string };
            if (d?.type !== 'ig-oauth') return;
            const expected = igStateRef.current;
            igStateRef.current = null;
            if (!d.code || !expected || d.state !== expected) {
                toast.error(t('igImport.authFailed'));
                return;
            }
            try {
                const { accessToken } = await exchangeInstagramCode(
                    d.code,
                    `${window.location.origin}/instagram-callback`
                );
                setIgAuth({ token: accessToken, source: 'instagram' });
            } catch {
                toast.error(t('igImport.authFailed'));
            }
        };
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openInstagramLogin = () => {
        const state = crypto.randomUUID();
        igStateRef.current = state;
        const redirectUri = `${window.location.origin}/instagram-callback`;
        const url =
            'https://www.instagram.com/oauth/authorize' +
            `?client_id=${IG_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            '&response_type=code' +
            '&scope=instagram_business_basic' +
            `&state=${state}`;
        const popup = window.open(url, 'ig-login', 'width=500,height=700');
        if (!popup) toast.error(t('igImport.authFailed'));
    };

    document.title = t('portfolio.title');

    const fetchWebConfigData = async () => {
        try {
            if (auth?.user?.webConfig_id) {
                await dispatch(fetchWebConfig(auth.user.webConfig_id));
            }
        } catch (error) {
            toast.error(t('portfolio.loadFailed'));
        }
    };

    useEffect(() => {
        if (!webConfig) fetchWebConfigData();
    }, [webConfig]);

    useEffect(() => {
        if (webConfig?.components?.portfolio) {
            setItems(webConfig.components.portfolio.items ?? []);
            setIsVisible(webConfig.components.portfolio.visible ?? true);
        }
    }, [webConfig]);

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const saveUpdatedItems = async (newItems: PortfolioItem[]) => {
        if (!webConfig) return;
        setIsSaving(true);
        try {
            const payload: any = {
                _id: webConfig._id,
                components: {
                    ...webConfig.components,
                    portfolio: { ...webConfig.components.portfolio, items: newItems },
                },
            };

            const res = await dispatch(updateWebConfig(payload));
            if (updateWebConfig.rejected.match(res)) throw new Error('Update rejected');

            toast.success(t('portfolio.updateSuccess'));
        } catch (error) {
            toast.error(t('portfolio.updateError'));
            setItems(webConfig.components.portfolio.items || []);
        } finally {
            setIsSaving(false);
        }
    };

    const handleToggleVisibility = async () => {
        if (!webConfig) return;
        const newVisible = !isVisible;
        setIsVisible(newVisible);
        setIsSavingVisibility(true);
        try {
            const payload: any = {
                _id: webConfig._id,
                components: {
                    ...webConfig.components,
                    portfolio: { ...webConfig.components.portfolio, visible: newVisible },
                },
            };
            const res = await dispatch(updateWebConfig(payload));
            if (updateWebConfig.rejected.match(res)) throw new Error();
            toast.success(t('portfolio.visibilityUpdateSuccess'));
        } catch {
            setIsVisible(!newVisible);
            toast.error(t('portfolio.updateError'));
        } finally {
            setIsSavingVisibility(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id !== over?.id && over) {
            const oldIndex = items.findIndex((item) => item.url === active.id);
            const newIndex = items.findIndex((item) => item.url === over.id);
            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);
            await saveUpdatedItems(newItems);
        }
    };

    const handleRemoveImage = async (url: string) => {
        const newItems = items.filter(item => item.url !== url);
        setItems(newItems);
        try {
            await saveUpdatedItems(newItems);
        } catch (e) {
            setItems(items);
        }
    };

    const handleUpdateTitle = async (url: string, newTitle: string) => {
        const newItems = items.map(item =>
            item.url === url ? { ...item, title: newTitle } : item
        );
        setItems(newItems);
        try {
            await saveUpdatedItems(newItems);
        } catch (e) {
            setItems(items);
        }
    };

    const handleUploadNewImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (items.length >= 12) {
            toast.error(t('portfolio.maxImages'));
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            const options = { maxSizeMB: 2, maxWidthOrHeight: 1920, useWebWorker: true, alwaysKeepResolution: true };
            const compressedFile = await imageCompression(file, options);

            const imgResponse = await uploadImage(compressedFile);
            if (!imgResponse) throw new Error("Failed to upload image");

            const newItem: PortfolioItem = { url: imgResponse.imageName, title: '', description: '' };
            const newItems = [...items, newItem];
            setItems(newItems);
            await saveUpdatedItems(newItems);
        } catch (error) {
            console.log(error);
            toast.error(t('portfolio.uploadError'));
        } finally {
            setIsLoading(false);
            e.target.value = '';
        }
    };

    /**
     * Import from Facebook (LT-010) or Instagram (LT-042) — both pickers feed
     * this. The Graph token lives only in this page's state for the lifetime
     * of the picker; what goes to our server is the CDN URL of each picked
     * photo, which it fetches and pushes through the same pipeline as a
     * manual upload.
     */
    const handleFacebookImport = async (urls: string[]) => {
        setIsLoading(true);
        try {
            const imported: PortfolioItem[] = [];
            for (const url of urls) {
                const { imageName } = await importImageFromUrl(url);
                imported.push({ url: imageName, title: '', description: '' });
            }
            const newItems = [...items, ...imported].slice(0, 12);
            setItems(newItems);
            await saveUpdatedItems(newItems);
        } catch (error) {
            console.log(error);
            toast.error(t('portfolio.uploadError'));
        } finally {
            setIsLoading(false);
        }
    };

    /** The Instagram tile, identical for both login routes — only onClick differs. */
    const igTile = (onClick: () => void) => (
        <button
            type="button"
            onClick={onClick}
            disabled={isLoading || isSaving}
            className="group flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-[#E1306C]/40 hover:border-[#E1306C] transition-colors disabled:opacity-50"
        >
            <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                style={{ background: 'rgba(225,48,108,0.08)' }}
            >
                <Instagram className="text-[#E1306C] w-7 h-7" />
            </div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-[#E1306C] transition-colors">
                {t('igImport.button')}
            </span>
        </button>
    );

    if (webConfigLoading && !webConfig) {
        return (
            <div className="flex justify-center items-center h-96 w-full">
                <RefreshCcw className="animate-spin text-primary h-8 w-8" />
            </div>
        );
    }

    const canAddMore = items.length < 12;
    const remainingSlots = 12 - items.length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 md:p-8 max-w-7xl mx-auto"
        >
            {/* Header */}
            <div className="mb-10">
                <div className="flex items-center gap-3 mb-1">
                    <ImageIcon className="text-primary w-6 h-6 shrink-0" />
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {t('portfolio.title')}
                    </h1>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                    {t('portfolio.description')}
                </p>
                <div
                    className="mt-3 inline-flex items-center px-4 py-1.5 rounded-full text-xs font-semibold"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(149,142,160,0.2)' }}
                >
                    <span className={`font-bold mr-1 ${items.length >= 12 ? 'text-red-400' : 'text-primary'}`}>
                        {items.length}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">/ 12 {t('portfolio.imagesUsed')}</span>
                </div>
            </div>

            {/* Grid Container */}
            <div style={GLASS} className="p-6">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                    autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 5 }}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <SortableContext items={items.map((i: any) => i.url)} strategy={rectSortingStrategy}>
                            {items.map((item: any) => (
                                <SortableImageItem
                                    key={item.url}
                                    item={item}
                                    onRemove={handleRemoveImage}
                                    onUpdateTitle={handleUpdateTitle}
                                />
                            ))}
                        </SortableContext>

                        {/* Add Image Placeholder */}
                        {canAddMore && (
                            <label
                                htmlFor="portfolio-image-upload"
                                className="aspect-square flex flex-col items-center justify-center group cursor-pointer transition-all duration-300 hover:bg-primary/5"
                                style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '2px dashed rgba(149,142,160,0.3)',
                                    borderRadius: '24px',
                                }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(139,92,246,0.4)';
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLLabelElement).style.borderColor = 'rgba(149,142,160,0.3)';
                                }}
                            >
                                {isLoading || isSaving ? (
                                    <RefreshCcw className="animate-spin text-primary w-8 h-8 mb-3" />
                                ) : (
                                    <div
                                        className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                                        style={{ background: 'rgba(255,255,255,0.05)' }}
                                    >
                                        <Plus className="text-primary w-7 h-7" />
                                    </div>
                                )}
                                <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors">
                                    {t('portfolio.newImage')}
                                </span>
                            </label>
                        )}

                        {canAddMore && (
                            <FacebookLogin
                                appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
                                scope="user_photos"
                                onSuccess={(response) => {
                                    if (response.accessToken) setFbToken(response.accessToken);
                                    else toast.error(t('fbImport.authFailed'));
                                }}
                                onFail={() => toast.error(t('fbImport.authFailed'))}
                                render={(renderProps: { onClick?: () => void }) => (
                                    <button
                                        type="button"
                                        onClick={renderProps.onClick}
                                        disabled={isLoading || isSaving}
                                        className="group flex flex-col items-center justify-center aspect-square rounded-2xl border-2 border-dashed border-[#1877F2]/40 hover:border-[#1877F2] transition-colors disabled:opacity-50"
                                    >
                                        <div
                                            className="w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                                            style={{ background: 'rgba(24,119,242,0.08)' }}
                                        >
                                            <Facebook className="text-[#1877F2] w-7 h-7" />
                                        </div>
                                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-[#1877F2] transition-colors">
                                            {t('fbImport.button')}
                                        </span>
                                    </button>
                                )}
                            />
                        )}

                        {canAddMore && (IG_APP_ID ? (
                            igTile(openInstagramLogin)
                        ) : (
                            <FacebookLogin
                                appId={import.meta.env.VITE_FACEBOOK_APP_ID || ''}
                                scope="instagram_basic,pages_show_list"
                                onSuccess={(response) => {
                                    if (response.accessToken) setIgAuth({ token: response.accessToken, source: 'facebook' });
                                    else toast.error(t('igImport.authFailed'));
                                }}
                                onFail={() => toast.error(t('igImport.authFailed'))}
                                render={(renderProps: { onClick?: () => void }) => igTile(() => renderProps.onClick?.())}
                            />
                        ))}
                    </div>
                </DndContext>

                {fbToken && (
                    <FacebookPhotoPicker
                        accessToken={fbToken}
                        remainingSlots={remainingSlots}
                        onClose={() => setFbToken(null)}
                        onImport={handleFacebookImport}
                    />
                )}

                {igAuth && (
                    <InstagramPhotoPicker
                        accessToken={igAuth.token}
                        source={igAuth.source}
                        remainingSlots={remainingSlots}
                        onClose={() => setIgAuth(null)}
                        onImport={handleFacebookImport}
                    />
                )}

                {items.length === 0 && (
                    <p className="text-center text-xs text-gray-500 dark:text-gray-500 italic mt-6">
                        {t('portfolio.emptyDesc')}
                    </p>
                )}
            </div>

            <input
                id="portfolio-image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUploadNewImage}
                disabled={isLoading || isSaving || !canAddMore}
            />

            {/* Bento bottom section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="md:col-span-2 flex items-center gap-6 p-6" style={GLASS}>
                    <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(52,211,153,0.1)' }}
                    >
                        <Sparkles className="text-emerald-400 w-7 h-7" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                            {t('portfolio.optimizationTitle')}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {t('portfolio.optimizationTip')}
                        </p>
                    </div>
                </div>
                <div className="flex flex-col items-center justify-center text-center p-6" style={GLASS}>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        {t('portfolio.visibilityStatus')}
                    </span>
                    <span className={`text-3xl font-bold transition-colors duration-300 ${isVisible ? 'text-primary' : 'text-gray-500 dark:text-gray-500'}`}>
                        {t(isVisible ? 'portfolio.visibilityLive' : 'portfolio.visibilityHidden')}
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {t(isVisible ? 'portfolio.visibilityDesc' : 'portfolio.visibilityHiddenDesc')}
                    </p>
                    <button
                        onClick={handleToggleVisibility}
                        disabled={isSavingVisibility}
                        dir="ltr"
                        aria-label={t('portfolio.showOnWebsite')}
                        className={`mt-4 relative inline-flex h-6 w-11 shrink-0 items-center rounded-full overflow-hidden transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                            isSavingVisibility ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                        } ${isVisible ? 'bg-primary' : 'bg-gray-600 dark:bg-gray-700'}`}
                    >
                        <span
                            className={`absolute h-4 w-4 rounded-full bg-white shadow transition-transform duration-300 ${
                                isVisible ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                    <span className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        {t('portfolio.showOnWebsite')}
                    </span>
                </div>
            </div>
        </motion.div>
    );
};

export default Portfolio;
