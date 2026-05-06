import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Edit2, Check, X as XIcon } from 'lucide-react';
import { PortfolioItem } from '../../types';
import globals from '../../services/globals';
import { useTranslation } from 'react-i18next';

interface Props {
    item: PortfolioItem;
    onRemove: (url: string) => void;
    onUpdateTitle: (url: string, newTitle: string) => void;
}

export const PortfolioImageCard = React.forwardRef<HTMLDivElement, {
    item: PortfolioItem;
    imageUrl: string;
    isDragging?: boolean;
    isSorting?: boolean;
    isEditing?: boolean;
    editTitle?: string;
    onEditClick?: () => void;
    onRemoveClick?: () => void;
    onSaveTitle?: (title: string) => void;
    onCancelEdit?: () => void;
    onTitleChange?: (title: string) => void;
    style?: React.CSSProperties;
    attributes?: any;
    listeners?: any;
}>(({
    item,
    imageUrl,
    isDragging,
    isSorting,
    isEditing,
    editTitle,
    onEditClick,
    onRemoveClick,
    onSaveTitle,
    onCancelEdit,
    onTitleChange,
    style,
    attributes,
    listeners
}, ref) => {
    const { t } = useTranslation();

    return (
        <div
            ref={ref}
            style={style}
            className={`relative group bg-light-surface dark:bg-dark-surface rounded-xl overflow-hidden shadow-sm border ${isDragging ? 'opacity-50' : ''} ${isSorting ? 'border-primary shadow-lg scale-105 z-10' : 'border-light-gray/20 dark:border-dark-gray/20 transition-all duration-200'
                }`}
        >
            {/* The Draggable Area (Image) */}
            <div
                className="aspect-square w-full relative outline-none touch-manipulation cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
            >
                <img
                    src={imageUrl}
                    alt={item.title || 'Portfolio Image'}
                    draggable={false}
                    className="w-full h-full object-cover cursor-grab active:cursor-grabbing select-none pointer-events-none"
                />
            </div>

            {/* The Action Overlay (Separated from DnD listeners) */}
            <div className="absolute inset-0 flex flex-col justify-end p-3 pointer-events-none">
                {/* Background Dim - only visible on hover or mobile */}
                <div className="absolute inset-0 bg-black/20 md:bg-black/40 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200" />

                <div className={`relative w-full z-10 ${isSorting || isDragging ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    {isEditing ? (
                        <div className="flex flex-col gap-2 w-full bg-black/60 p-2 rounded-lg backdrop-blur-md"
                            onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={editTitle}
                                onChange={e => onTitleChange?.(e.target.value)}
                                className="w-full bg-white/20 text-white placeholder-white/60 border border-white/20 rounded-md px-2 py-1.5 text-base md:text-sm focus:outline-none focus:border-primary transition-colors pointer-events-auto"
                                placeholder={t('portfolio.enterTitle')}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSaveTitle?.(editTitle || '');
                                    if (e.key === 'Escape') onCancelEdit?.();
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancelEdit?.(); }}
                                    className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer touch-manipulation"
                                    aria-label={t('common.cancel')}
                                >
                                    <XIcon size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSaveTitle?.(editTitle || ''); }}
                                    className="p-1.5 rounded-md bg-primary hover:bg-primary-dark text-white transition-colors shadow-md cursor-pointer touch-manipulation"
                                    aria-label={t('common.save')}
                                >
                                    <Check size={16} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex justify-between items-end gap-2 w-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200">
                            <div className="text-white text-sm font-medium drop-shadow-md truncate max-w-[55%] flex-1">
                                {item.title ? item.title : (
                                    <span className="opacity-70 italic font-normal text-xs">
                                        {t('portfolio.addTitle')}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditClick?.();
                                    }}
                                    className="p-2 bg-white/30 md:bg-white/20 hover:bg-white/40 rounded-lg text-white backdrop-blur-sm transition-colors cursor-pointer touch-manipulation"
                                    aria-label={t('portfolio.editTitle')}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRemoveClick?.();
                                    }}
                                    className="p-2 bg-red-500/90 md:bg-red-500/80 hover:bg-red-600 rounded-lg text-white backdrop-blur-sm transition-colors cursor-pointer touch-manipulation"
                                    aria-label={t('portfolio.deleteImage')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const SortableImageItem: React.FC<Props> = ({ item, onRemove, onUpdateTitle }) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        isSorting,
    } = useSortable({ id: item.url });

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(item.title || '');

    const handleCancelEdit = () => {
        setEditTitle(item.title || '');
        setIsEditing(false);
    };

    const style = {
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? 'none' : transition,
        zIndex: isDragging ? 2 : 1,
    };

    const imageUrl = item.url.startsWith('http')
        ? item.url
        : `${globals.imagesUrl}${item.url}`;

    return (
        <PortfolioImageCard
            ref={setNodeRef}
            item={item}
            imageUrl={imageUrl}
            isDragging={isDragging}
            isSorting={isSorting}
            isEditing={isEditing}
            editTitle={editTitle}
            onEditClick={() => {
                setIsEditing(true);
                setEditTitle(item.title || '');
            }}
            onRemoveClick={() => {
                if (window.confirm(t('portfolio.deleteImageConfirm'))) {
                    onRemove(item.url);
                }
            }}
            onSaveTitle={(title) => {
                onUpdateTitle(item.url, title.trim());
                setIsEditing(false);
            }}
            onCancelEdit={handleCancelEdit}
            onTitleChange={setEditTitle}
            style={style}
            attributes={attributes}
            listeners={listeners}
        />
    );
};

export default SortableImageItem;
