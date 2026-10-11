import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, GripVertical, Lock, Plus } from 'lucide-react';
import {
  DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import type { SectionRow } from '../../utils/siteSections';
import { SECTION_ICONS } from './sectionIcons';
import { sectionLabel, vocabLang } from './labels';

interface SectionsPanelProps {
  rows: SectionRow[];
  /** The row of the section selected in the preview, if any. */
  selectedId: string | null;
  onSelect: (row: SectionRow) => void;
  onToggleHidden: (row: SectionRow) => void;
  /** `to`: the row's new position in the whole list. */
  onMove: (row: SectionRow, to: number) => void;
  onAdd: () => void;
}

interface RowProps {
  row: SectionRow;
  selected: boolean;
  locked: boolean;
  onSelect: (row: SectionRow) => void;
  onToggleHidden: (row: SectionRow) => void;
}

/** One section: a handle to drag it (the opening and the footer stay put), its name, and its eye. */
function Row({ row, selected, locked, onSelect, onToggleHidden }: RowProps) {
  const { t, i18n } = useTranslation();
  const name = sectionLabel(row.type, vocabLang(i18n.language));
  const Icon = SECTION_ICONS[row.type];
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: locked });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`relative flex items-center bg-white dark:bg-slate-900 ${isDragging ? 'z-10 shadow-lg ring-1 ring-primary/30' : ''} ${selected ? 'bg-violet-50 dark:bg-violet-900/20' : ''}`}
      data-testid={`section-row-${row.id}`}
    >
      {locked ? (
        <span className="w-10 h-12 shrink-0 flex items-center justify-center text-gray-300 dark:text-slate-600" title={t('siteEditor.sections.locked', { name })}>
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      ) : (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={t('siteEditor.sections.drag', { name })}
          className="w-10 h-12 shrink-0 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-primary cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onSelect(row)}
        aria-current={selected || undefined}
        className={`flex-1 min-w-0 h-12 flex items-center gap-2 text-start text-sm ${row.hidden ? 'text-gray-400 dark:text-slate-500' : selected ? 'text-primary font-medium' : 'text-gray-700 dark:text-slate-200'}`}
      >
        {Icon && <Icon className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />}
        <span className="truncate">{name}</span>
        {row.hidden && <span className="shrink-0 text-[11px] text-amber-600 dark:text-amber-400">{t('siteEditor.sections.hiddenTag')}</span>}
      </button>
      <button
        type="button"
        onClick={() => onToggleHidden(row)}
        aria-label={t(row.hidden ? 'siteEditor.sections.show' : 'siteEditor.sections.hide', { name })}
        aria-pressed={!row.hidden}
        className="w-11 h-12 shrink-0 flex items-center justify-center text-gray-400 dark:text-slate-500 hover:text-primary"
      >
        {row.hidden ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
      </button>
    </li>
  );
}

/**
 * LT-252: the page's sections in order — drag one by its handle to move it
 * (touch: hold, then drag), the eye hides or shows it, a tap selects it in
 * the preview; and the way to add the sections the page does not have.
 */
function SectionsPanel({ rows, selectedId, onSelect, onToggleHidden, onMove, onAdd }: SectionsPanelProps) {
  const { t } = useTranslation();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const isLocked = (row: SectionRow, i: number) => (i === 0 && row.type === 'hero') || (i === rows.length - 1 && row.type === 'footer');

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const row = rows.find((r) => r.id === active.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (!row || to === -1 || isLocked(rows[to], to)) return;
    onMove(row, to);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="sections-panel">
      <p className="text-xs text-gray-500 dark:text-slate-400">{t('siteEditor.sections.hint')}</p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragEnd={onDragEnd}>
        <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          <ul className="rounded-2xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-800 overflow-hidden">
            {rows.map((row, i) => (
              <Row
                key={row.id}
                row={row}
                selected={row.id === selectedId}
                locked={isLocked(row, i)}
                onSelect={onSelect}
                onToggleHidden={onToggleHidden}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={onAdd}
        className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 text-sm font-medium text-primary hover:bg-violet-50 dark:hover:bg-violet-900/20"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t('siteEditor.sections.add')}
      </button>
    </div>
  );
}

export default SectionsPanel;
