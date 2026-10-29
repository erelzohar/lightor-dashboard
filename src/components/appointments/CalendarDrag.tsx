import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useDraggable, type CollisionDetection, type DraggableAttributes, type DraggableSyntheticListeners } from '@dnd-kit/core';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { Appointment } from '../../types';
import { swappedStarts } from '../../utils/calendarDrag';

/**
 * The pieces the calendar drags with (LT-345): a booking block that can be
 * picked up, where the pointer is, and the window that asks before anything
 * is sent.
 *
 * Where a booking lands is read off the pointer and the columns as drawn
 * (LT-353), not off dnd-kit's drop targets: the page may turn to another day
 * or week under a held booking, and the block it was picked up from leaves
 * the screen with it.
 */

export const dragId = (appointment: Appointment) => `drag:${appointment._id}`;

export type Point = { x: number; y: number };

/**
 * dnd-kit's collision step, used only to hear where the pointer is: it is
 * the one place handed the pointer's own coordinates, every move, however
 * the page has scrolled or turned since the drag began.
 */
export const pointerTracker =
  (into: { current: Point | null }): CollisionDetection =>
  ({ pointerCoordinates }) => {
    if (pointerCoordinates) into.current = { x: pointerCoordinates.x, y: pointerCoordinates.y };
    return [];
  };

export interface DragHandle {
  setNodeRef: (node: HTMLElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  isDragging: boolean;
}

/** A booking block that may be picked up. */
export const DragBlock: React.FC<{
  appointment: Appointment;
  /** Whether it may be picked up. */
  enabled: boolean;
  children: (handle: DragHandle) => React.ReactNode;
}> = ({ appointment, enabled, children }) => {
  const drag = useDraggable({ id: dragId(appointment), data: { appointment }, disabled: !enabled });
  return (
    <>
      {children({
        setNodeRef: drag.setNodeRef,
        listeners: enabled ? drag.listeners : undefined,
        attributes: enabled ? drag.attributes : undefined,
        isDragging: drag.isDragging,
      })}
    </>
  );
};

export type PendingDrop =
  | { kind: 'move'; appointment: Appointment; startMs: number; warning?: 'outsideHours' | 'vacation' }
  | { kind: 'swap'; appointment: Appointment; target: Appointment };

/**
 * Asks before a drop is sent (Erel, LT-345: every time — each sends the
 * customer a message). LT-422 (Erel: "show the real time, bold and clear"):
 * each booking as a card - who and what, its time now, and its new day and
 * hours, from start to end, in bold. A swap's new times are the ones the
 * server will set (swappedStarts), listed in the order they will run.
 * LT-497 (Erel: "it looks crooked, centre it"): everything on the middle
 * line, the cards as wide as the dialog.
 */
export const DropConfirm: React.FC<{
  pending: PendingDrop | null;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ pending, saving, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const { language } = useTheme();
  const locale = language === 'he' ? he : undefined;
  const day = (ms: number) => format(new Date(ms), 'EEEE d/M', { locale });
  // The range keeps its own direction (an RTL page reversed it).
  const hours = (start: number, length: number) => (
    <span dir="ltr">{`${format(new Date(start), 'HH:mm')}–${format(new Date(start + length), 'HH:mm')}`}</span>
  );
  const card = (appointment: Appointment, from: number, to: number) => {
    const length = Number(appointment.type?.durationMS) || 0;
    return (
      <div key={appointment._id} className="rounded-xl bg-gray-50 dark:bg-gray-700/40 px-3 py-2.5 space-y-1" data-testid="drop-card">
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {appointment.name}
          {appointment.type?.name && <span className="font-normal text-gray-500 dark:text-gray-400"> · {appointment.type.name}</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {t('appointments.drag.now')}: {day(from)}, {hours(from, length)}
        </p>
        <p className="text-sm font-bold text-primary dark:text-violet-300" data-testid="drop-new-time">
          {t('appointments.drag.newTime')}: {day(to)}, {hours(to, length)}
        </p>
      </div>
    );
  };

  let message: React.ReactNode = null;
  if (pending?.kind === 'move') {
    message = (
      <div className="space-y-2" data-testid="drop-confirm">
        {card(pending.appointment, Number(pending.appointment.timestamp), pending.startMs)}
        {pending.warning && (
          <p className="text-sm text-amber-700 dark:text-amber-300">{t(`appointments.drag.${pending.warning}`)}</p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.drag.notifyOne')}</p>
      </div>
    );
  } else if (pending?.kind === 'swap') {
    const next = swappedStarts(pending.appointment, pending.target);
    const cards = [
      { appointment: pending.appointment, to: next.a },
      { appointment: pending.target, to: next.b },
    ].sort((x, y) => x.to - y.to);
    message = (
      <div className="space-y-2" data-testid="drop-confirm">
        {cards.map(({ appointment, to }) => card(appointment, Number(appointment.timestamp), to))}
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.drag.notifyBoth')}</p>
      </div>
    );
  }

  return (
    <ConfirmDialog
      open={!!pending}
      title={t(pending?.kind === 'swap' ? 'appointments.drag.swapTitle' : 'appointments.drag.moveTitle')}
      message={message}
      confirmLabel={t(pending?.kind === 'swap' ? 'appointments.drag.swap' : 'appointments.drag.move')}
      cancelLabel={t('customers.block.cancel')}
      loading={saving}
      centered
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
