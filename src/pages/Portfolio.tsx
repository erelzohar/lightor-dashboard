import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCcw, Image as ImageIcon, Plus } from 'lucide-react';
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

import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { useAppDispatch } from '../hooks/useAppDispatch';
import { useAppSelector } from '../hooks/useAppSelector';
import { fetchWebConfig, updateWebConfig } from '../store/slices/webConfigSlice';
import { uploadImage } from '../services/imagesApi';
import SortableImageItem from '../components/portfolio/SortableImageItem';
import { PortfolioItem } from '../types';

const Portfolio: React.FC = () => {
    const { language } = useTheme();
    const { auth } = useAuth();
    const dispatch = useAppDispatch();

    const webConfig = useAppSelector(state => state.webConfig.data);
    const webConfigLoading = useAppSelector(state => state.webConfig.loading);

    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Local state for instant UI updates during drag & drop before saving 
    const [items, setItems] = useState(webConfig?.components?.portfolio?.items || []);

    document.title = language === 'he' ? 'גלריה' : 'Portfolio';

    const fetchWebConfigData = async () => {
        try {
            if (auth?.user?.webConfig_id) {
                await dispatch(fetchWebConfig(auth.user.webConfig_id));
            }
        } catch (error) {
            toast.error(
                language === 'he'
                    ? 'אירעה שגיאה בטעינת ההגדרות'
                    : 'Failed to load settings'
            );
        }
    };

    useEffect(() => {
        if (!webConfig) {
            fetchWebConfigData();
        }
    }, [webConfig]);

    useEffect(() => {
        if (webConfig?.components?.portfolio?.items) {
            setItems(webConfig.components.portfolio.items);
        }
    }, [webConfig]);

    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                // 250ms delay distinguishes scroll intent from drag intent on mobile
                delay: 250,
                // Low tolerance so any movement during delay cancels drag (lets scroll win)
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const saveUpdatedItems = async (newItems: PortfolioItem[]) => {
        if (!webConfig) return;
        setIsSaving(true);

        try {
            const payload: any = {
                _id: webConfig._id,
                components: {
                    ...webConfig.components,
                    portfolio: {
                        ...webConfig.components.portfolio,
                        items: newItems,
                    },
                },
            };

            const res = await dispatch(updateWebConfig(payload));

            if (updateWebConfig.rejected.match(res)) {
                throw new Error('Update rejected');
            }

            toast.success(
                language === 'he'
                    ? 'הגלריה עודכנה בהצלחה'
                    : 'Portfolio updated successfully'
            );
        } catch (error) {
            toast.error(
                language === 'he'
                    ? 'שגיאה בשמירת הגלריה'
                    : 'Error saving portfolio'
            );
            // Revert UI to DB state on fail
            setItems(webConfig.components.portfolio.items || []);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id && over) {
            const oldIndex = items.findIndex((item) => item.url === active.id);
            const newIndex = items.findIndex((item) => item.url === over.id);

            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);

            // Persist changes
            await saveUpdatedItems(newItems);
        }
    };

    const handleRemoveImage = async (url: string) => {
        // Optimistic UI update
        const newItems = items.filter(item => item.url !== url);
        setItems(newItems);

        try {
            // 1. Send call to actually delete it
            // if it's external full URL or internally hosted? 
            // Assuming imagesApi.deleteImage expects the string identifier
            // try {
            //   await deleteImage(url);
            // } catch(e) { console.log('Delete image silently failed', e); }

            // 2. update DB configuration
            await saveUpdatedItems(newItems);

        } catch (e) {
            // Revert if failed
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
            setItems(items); // Revert on fail
        }
    };


    const handleUploadNewImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (items.length >= 12) {
            toast.error(
                language === 'he'
                    ? 'הגעת למקסימום התמונות האפשרי (12)'
                    : 'You have reached the maximum number of images (12)'
            );
            return;
        }

        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        try {
            // Compress and fix EXIF orientation
            const options = {
                maxSizeMB: 2,
                maxWidthOrHeight: 1920,
                useWebWorker: true,
                alwaysKeepResolution: true
            };
            const compressedFile = await imageCompression(file, options);

            const imgResponse = await uploadImage(compressedFile);
            if (!imgResponse) throw new Error("Failed to upload image");

            const newItem: PortfolioItem = {
                url: imgResponse.imageName,
                title: '',
                description: '',
            };

            const newItems = [...items, newItem];
            setItems(newItems);
            await saveUpdatedItems(newItems);

        } catch (error) {
            console.log(error);
            toast.error(language === 'he' ? 'שגיאה בהעלאת התמונה' : 'Error uploading image');
        } finally {
            setIsLoading(false);
            // reset file input
            e.target.value = '';
        }
    };

    if (webConfigLoading && !webConfig) {
        return (
            <div className="flex justify-center items-center h-96 w-full">
                <RefreshCcw className="animate-spin text-primary h-8 w-8" />
            </div>
        );
    }

    const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
        <div className="flex items-center gap-2">
            <Icon className="text-primary w-5 h-5" />
            <h1 className="font-semibold text-xl text-gray-800 dark:text-white">{title}</h1>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 max-w-7xl mx-auto"
        >
            <div className="flex justify-between items-start mb-6">
                <div>
                    <SectionHeader
                        icon={ImageIcon}
                        title={language === 'he' ? 'ניהול גלריית תמונות' : 'Manage Portfolio'}
                    />
                    <p className="text-light-text dark:text-gray-400 text-sm mt-1 mb-2">
                        {language === 'he' ? 'גרור תמונות כדי לשנות את סדר התצוגה שלהן' : 'Drag and drop images to reorder them'}
                    </p>
                    <p className="text-sm font-medium mt-2">
                        <span className={items.length >= 12 ? 'text-red-500' : 'text-primary'}>
                            {items.length}
                        </span>
                        <span className="text-light-gray dark:text-dark-gray"> / 12</span>
                    </p>
                </div>

                {/* Upload Button */}
                <div>
                    <label
                        htmlFor={items.length >= 12 ? undefined : "portfolio-image-upload"}
                        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-md transition text-sm font-medium ${items.length >= 12 || isLoading || isSaving
                            ? 'bg-light-gray text-white opacity-50 cursor-not-allowed'
                            : 'bg-primary text-white hover:bg-primary-dark active:scale-95 cursor-pointer'
                            }`}
                        onClick={(e) => {
                            if (items.length >= 12) {
                                e.preventDefault();
                                toast.error(
                                    language === 'he'
                                        ? 'ניתן להוסיף עד 12 תמונות לגלריה'
                                        : 'You can add up to 12 images to the portfolio'
                                );
                            }
                        }}
                    >
                        {isLoading ? (
                            <RefreshCcw className="animate-spin w-4 h-4" />
                        ) : (
                            <Plus className="w-4 h-4" />
                        )}
                        {language === 'he' ? 'תמונה חדשה' : 'New Image'}
                    </label>
                    <input
                        id="portfolio-image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleUploadNewImage}
                        disabled={isLoading || isSaving}
                    />
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-sm border border-light-gray/20 dark:border-dark-gray/20 p-6">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-light-text text-center">
                        <ImageIcon className="w-16 h-16 text-light-gray mb-4" />
                        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
                            {language === 'he' ? 'הגלריה ריקה' : 'Portfolio is empty'}
                        </h4>
                        <p className="text-sm max-w-sm">
                            {language === 'he'
                                ? 'לא נמצאו תמונות בגלריה שלך. אנא לחץ על כפתור ״הוסף תמונה חדשה״ במעלה העמוד כדי להוסיף את התמונה הראשונה.'
                                : 'No images found in your portfolio. Click "Add New Image" at the top to add your first photo.'}
                        </p>
                    </div>
                ) : (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                        autoScroll={{
                            threshold: { x: 0, y: 0.15 },
                            acceleration: 5,
                        }}
                        measuring={{
                            droppable: {
                                strategy: MeasuringStrategy.Always,
                            },
                        }}
                    >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            <SortableContext items={items.map((i: any) => i.url)} strategy={rectSortingStrategy}>
                                {items.map((item: any) => (
                                    <SortableImageItem
                                        key={item.url}
                                        item={item}
                                        onRemove={handleRemoveImage}
                                        onUpdateTitle={handleUpdateTitle}
                                        language={language}
                                    />
                                ))}
                            </SortableContext>
                        </div>
                    </DndContext>
                )}
            </div>

        </motion.div>
    );
};

export default Portfolio;
