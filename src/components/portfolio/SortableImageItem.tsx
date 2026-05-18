import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Edit2, Check, X as XIcon, GripVertical } from 'lucide-react';
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
            style={{
                ...style,
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(12px)',
            }}
            className={`relative group aspect-square overflow-hidden transition-all duration-300 cursor-grab active:cursor-grabbing
                rounded-[24px]
                ${isSorting || isDragging
                    ? 'scale-105 z-10 shadow-[0_0_25px_rgba(139,92,246,0.35)] border border-primary/50'
                    : 'border border-white/[0.08] hover:border-primary/50 hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]'
                }
                ${isDragging ? 'opacity-50' : ''}
            `}
        >
            {/* Draggable image area */}
            <div
                className="w-full h-full outline-none touch-manipulation"
                {...attributes}
                {...listeners}
            >
                <img
                    src={imageUrl}
                    alt={item.title || 'Portfolio Image'}
                    draggable={false}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 select-none pointer-events-none"
                />
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4 pointer-events-none">
                {/* Top: action buttons */}
                <div className={`flex justify-end gap-2 ${isSorting || isDragging ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    {!isEditing && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); onEditClick?.(); }}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-white shadow-lg transition-all duration-200 hover:scale-110 touch-manipulation"
                                style={{ background: 'rgba(11,19,38,0.8)', backdropFilter: 'blur(8px)' }}
                                aria-label={t('portfolio.editTitle')}
                            >
                                <Edit2 size={15} />
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemoveClick?.(); }}
                                className="w-10 h-10 rounded-full flex items-center justify-center text-red-400 shadow-lg transition-all duration-200 hover:scale-110 hover:bg-red-500 hover:text-white touch-manipulation"
                                style={{ background: 'rgba(11,19,38,0.8)', backdropFilter: 'blur(8px)' }}
                                aria-label={t('portfolio.deleteImage')}
                            >
                                <Trash2 size={15} />
                            </button>
                        </>
                    )}
                </div>

                {/* Bottom: title / edit form */}
                <div className={`${isSorting || isDragging ? 'pointer-events-none' : 'pointer-events-auto'}`}>
                    {isEditing ? (
                        <div
                            className="flex flex-col gap-2 w-full p-2 rounded-xl"
                            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="text"
                                value={editTitle}
                                onChange={e => onTitleChange?.(e.target.value)}
                                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/20 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary transition-colors pointer-events-auto"
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
                                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer touch-manipulation"
                                    aria-label={t('common.cancel')}
                                >
                                    <XIcon size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSaveTitle?.(editTitle || ''); }}
                                    className="p-1.5 rounded-lg bg-primary hover:brightness-110 text-white transition-colors shadow-md cursor-pointer touch-manipulation"
                                    aria-label={t('common.save')}
                                >
                                    <Check size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 text-white/90 text-xs font-medium">
                            <GripVertical size={16} className="opacity-70 shrink-0" />
                            <span className="truncate drop-shadow-md">
                                {item.title || (
                                    <span className="opacity-60 italic font-normal">
                                        {t('portfolio.addTitle')}
                                    </span>
                                )}
                            </span>
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
