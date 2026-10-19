import type { TFunction } from 'i18next';
import type { DndContextProps, UniqueIdentifier } from '@dnd-kit/core';

/**
 * LT-429: what a screen reader hears while reordering a list with the
 * keyboard, in the owner's language and by the items' names. dnd-kit's own
 * lines are English and read out internal ids ("Draggable item b2 was dropped
 * over droppable area b5").
 */
export const sortableA11y = (t: TFunction, nameOf: (id: UniqueIdentifier) => string): NonNullable<DndContextProps['accessibility']> => ({
  screenReaderInstructions: { draggable: t('common.sortable.instructions') },
  announcements: {
    onDragStart: ({ active }) => t('common.sortable.picked', { name: nameOf(active.id) }),
    onDragOver: ({ active, over }) => (over && over.id !== active.id ? t('common.sortable.over', { name: nameOf(active.id), over: nameOf(over.id) }) : undefined),
    onDragEnd: ({ active, over }) => (over && over.id !== active.id ? t('common.sortable.dropped', { name: nameOf(active.id), over: nameOf(over.id) }) : undefined),
    onDragCancel: () => t('common.sortable.cancelled'),
  },
});
