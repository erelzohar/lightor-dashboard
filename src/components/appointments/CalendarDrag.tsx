import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useDraggable, type CollisionDetection, type DraggableAttributes, type DraggableSyntheticListeners } from '@dnd-kit/core';
import ConfirmDialog from '../ui/ConfirmDialog';
import { useTheme } from '../../contexts/ThemeContext';
import type { Appointment } from '../../types';

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
