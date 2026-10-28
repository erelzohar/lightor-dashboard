import React, { useState } from 'react';
import { AxiosError } from 'axios';
import toast from 'react-hot-toast';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Trash2, Edit2, Check, X as XIcon, GripVertical, Sparkles, Loader2 } from 'lucide-react';
import { PortfolioItem } from '../../types';
import globals from '../../services/globals';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '../../hooks/useConfirm';
import { aiService } from '../../services/aiApi';
import { isAiBusy } from '../../lib/aiErrors';

/** LT-346: what the owner edits on a picture — its title and its description for screen readers. */
export interface PortfolioItemEdit { title: string; alt: string }

interface Props {
    item: PortfolioItem;
    onRemove: (url: string) => void;
    onUpdate: (url: string, edit: PortfolioItemEdit) => void;
    /** The site's language: the description is written in it. */
    siteLanguage: string;
}

export const PortfolioImageCard = React.forwardRef<HTMLDivElement, {
    item: PortfolioItem;
    imageUrl: string;
    isDragging?: boolean;
    isSorting?: boolean;
    isEditing?: boolean;
    editTitle?: string;
    editAlt?: string;
    suggesting?: boolean;
    onEditClick?: () => void;
    onRemoveClick?: () => void;
    onSave?: () => void;
    onCancelEdit?: () => void;
    onTitleChange?: (title: string) => void;
    onAltChange?: (alt: string) => void;
    onSuggestAlt?: () => void;
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
    editAlt,
    suggesting,
    onEditClick,
    onRemoveClick,
    onSave,
    onCancelEdit,
    onTitleChange,
    onAltChange,
    onSuggestAlt,
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
                className="w-full h-full outline-none touch-manipulation rounded-[24px] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                {...attributes}
                {...listeners}
            >
                <img
                    src={imageUrl}
                    alt={item.alt || item.title || ''}
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
                                aria-label={t('portfolio.enterTitle')}
                                autoFocus
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSave?.();
                                    if (e.key === 'Escape') onCancelEdit?.();
                                }}
                            />
                            {/* LT-346: the picture's description for visitors who cannot see it. */}
                            <textarea
                                value={editAlt}
                                onChange={e => onAltChange?.(e.target.value)}
                                rows={2}
                                maxLength={300}
                                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/20 rounded-lg px-3 py-1.5 text-xs leading-snug resize-none focus:outline-none focus:border-primary transition-colors pointer-events-auto"
                                placeholder={t('portfolio.altPlaceholder')}
                                aria-label={t('portfolio.altLabel')}
                                onKeyDown={(e) => {
                                    if (e.key === 'Escape') onCancelEdit?.();
                                }}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); onSuggestAlt?.(); }}
                                    disabled={suggesting}
                                    className="me-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs transition-colors cursor-pointer touch-manipulation disabled:opacity-60"
                                >
                                    {suggesting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
                                    {t('portfolio.altSuggest')}
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onCancelEdit?.(); }}
                                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors cursor-pointer touch-manipulation"
                                    aria-label={t('common.cancel')}
                                >
                                    <XIcon size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); onSave?.(); }}
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
                            {/* LT-346: a nudge — a picture without a description is silent to a screen reader. */}
                            {!item.alt && (
                                <span className="ms-auto shrink-0 rounded-full bg-amber-500/80 px-2 py-0.5 text-[0.625rem] font-semibold text-white">
                                    {t('portfolio.altMissing')}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

const SortableImageItem: React.FC<Props> = ({ item, onRemove, onUpdate, siteLanguage }) => {
    const { t } = useTranslation();
    const { confirm, dialog } = useConfirm();
    const askRemove = async () => {
        const ok = await confirm({
            title: t('portfolio.deleteImageDialog.title'),
            message: t('portfolio.deleteImageDialog.body'),
            confirmLabel: t('portfolio.deleteImageDialog.confirm'),
            danger: true,
        });
        if (ok) onRemove(item.url);
    };
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
    const [editAlt, setEditAlt] = useState(item.alt || '');
    const [suggesting, setSuggesting] = useState(false);

    const handleCancelEdit = () => {
        setEditTitle(item.title || '');
        setEditAlt(item.alt || '');
        setIsEditing(false);
    };

    // LT-346: the AI looks at the picture and drafts its description; the
    // owner reads it and saves (or changes it) — nothing is stored here.
    const handleSuggestAlt = async () => {
        setSuggesting(true);
        try {
            setEditAlt(await aiService.describeImage(item.url, siteLanguage));
        } catch (err) {
            const status = (err as AxiosError)?.response?.status;
            toast.error(t(isAiBusy(err) ? 'common.aiBusy' : status === 429 ? 'portfolio.altSuggestBudget' : 'portfolio.altSuggestFailed'));
        } finally {
            setSuggesting(false);
        }
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
        <>
        <PortfolioImageCard
            ref={setNodeRef}
            item={item}
            imageUrl={imageUrl}
            isDragging={isDragging}
            isSorting={isSorting}
            isEditing={isEditing}
            editTitle={editTitle}
            editAlt={editAlt}
            suggesting={suggesting}
            onEditClick={() => {
                setIsEditing(true);
                setEditTitle(item.title || '');
                setEditAlt(item.alt || '');
            }}
            onRemoveClick={() => void askRemove()}
            onSave={() => {
                onUpdate(item.url, { title: editTitle.trim(), alt: editAlt.trim() });
                setIsEditing(false);
            }}
            onCancelEdit={handleCancelEdit}
            onTitleChange={setEditTitle}
            onAltChange={setEditAlt}
            onSuggestAlt={handleSuggestAlt}
            style={style}
            attributes={attributes}
            listeners={listeners}
        />
        {/* Beside the card, not in it: the card carries the drag's listeners. */}
        {dialog}
        </>
    );
};

export default SortableImageItem;
