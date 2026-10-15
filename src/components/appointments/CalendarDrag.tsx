import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
} from '@dnd-kit/core';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { Appointment } from '../../types';

/**
 * The pieces the calendar drags with (LT-345): a booking block that can be
 * picked up and dropped onto, a day column to drop into, the rule that tells
 * which of the two a pointer is over, and the window that asks before
 * anything is sent.
 */

export const dragId = (appointment: Appointment) => `drag:${appointment._id}`;
export const dropId = (appointment: Appointment) => `drop:${appointment._id}`;
export const dayId = (index: number) => `day:${index}`;

/**
 * Under the pointer, a booking to swap with beats the day column it sits in;
 * the dragged booking's own place never counts. A keyboard or a lost pointer
 * falls back to the dragged block's overlap.
 */
export const calendarCollision: CollisionDetection = (args) => {
  const own = `drop:${String(args.active.id).slice('drag:'.length)}`;
  const hits = (args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args)).filter((hit) => hit.id !== own);
  const booking = hits.find((hit) => String(hit.id).startsWith('drop:'));
  if (booking) return [booking];
  const column = hits.find((hit) => String(hit.id).startsWith('day:'));
  return column ? [column] : [];
};

export interface DragHandle {
  setNodeRef: (node: HTMLElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  attributes?: DraggableAttributes;
  /** The drag so far, scroll included; null while still. */
  transform: { x: number; y: number } | null;
  isDragging: boolean;
  /** Another booking is being dragged over this one: a swap would land here. */
  isSwapTarget: boolean;
}

/** A booking block that may be picked up, and dropped onto to swap. */
export const DragBlock: React.FC<{
  appointment: Appointment;
  /** Whether it may be picked up, and be swapped with. */
  enabled: boolean;
  children: (handle: DragHandle) => React.ReactNode;
}> = ({ appointment, enabled, children }) => {
  const drag = useDraggable({ id: dragId(appointment), data: { appointment }, disabled: !enabled });
  const drop = useDroppable({ id: dropId(appointment), data: { appointment }, disabled: !enabled });
  const setNodeRef = (node: HTMLElement | null) => {
    drag.setNodeRef(node);
    drop.setNodeRef(node);
  };
  return (
    <>
      {children({
        setNodeRef,
        listeners: enabled ? drag.listeners : undefined,
        attributes: enabled ? drag.attributes : undefined,
        transform: drag.transform ? { x: drag.transform.x, y: drag.transform.y } : null,
        isDragging: drag.isDragging,
        isSwapTarget: enabled && drop.isOver && !drag.isDragging,
      })}
    </>
  );
};

/** A day column a booking can be dropped into. */
export const DropColumn: React.FC<{
  index: number;
  children: (setNodeRef: (node: HTMLElement | null) => void) => React.ReactNode;
}> = ({ index, children }) => {
  const { setNodeRef } = useDroppable({ id: dayId(index), data: { index } });
  return <>{children(setNodeRef)}</>;
};

export type PendingDrop =
  | { kind: 'move'; appointment: Appointment; startMs: number; warning?: 'outsideHours' | 'vacation' }
  | { kind: 'swap'; appointment: Appointment; target: Appointment };

/**
 * Asks before a drop is sent (Erel, LT-345: every time — each sends the
 * customer a message): the booking's old and new time, or the two bookings
 * of a swap and where each goes.
 */
export const DropConfirm: React.FC<{
  pending: PendingDrop | null;
  saving: boolean;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ pending, saving, onConfirm, onClose }) => {
  const { t } = useTranslation();
  const { language, direction } = useTheme();
  // Toward the new time, in the reading direction.
  const arrow = direction === 'rtl' ? '←' : '→';
  const locale = language === 'he' ? he : undefined;
  const when = (ms: number) => format(new Date(ms), 'EEEE d/M, HH:mm', { locale });
  const line = (name: string, from: number, to: number) => (
    <p className="text-sm text-gray-700 dark:text-gray-200">
      <span className="font-semibold">{name}</span>: {when(from)} {arrow} {when(to)}
    </p>
  );

  let message: React.ReactNode = null;
  if (pending?.kind === 'move') {
    message = (
      <div className="space-y-2" data-testid="drop-confirm">
        {line(pending.appointment.name, Number(pending.appointment.timestamp), pending.startMs)}
        {pending.warning && (
          <p className="text-sm text-amber-700 dark:text-amber-300">{t(`appointments.drag.${pending.warning}`)}</p>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('appointments.drag.notifyOne')}</p>
      </div>
    );
  } else if (pending?.kind === 'swap') {
    const a = Number(pending.appointment.timestamp);
    const b = Number(pending.target.timestamp);
    message = (
      <div className="space-y-2" data-testid="drop-confirm">
        {line(pending.appointment.name, a, b)}
        {line(pending.target.name, b, a)}
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
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
};
