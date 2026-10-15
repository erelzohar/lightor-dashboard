import type { TFunction } from 'i18next';
import type { ConfirmOptions } from '../../hooks/useConfirm';

/**
 * The question before the owner cancels a booking (LT-347). The way out says
 * "keep the booking", never a bare "Cancel" beside "Cancel the booking". A
 * booking still ahead tells its customer: the server sends them the
 * business's cancellation with a link to book again; one already past does not.
 */
export const cancelBookingQuestion = (t: TFunction, timestamp: string | number): ConfirmOptions => ({
  title: t('appointments.cancelDialog.title'),
  message: t(Number(timestamp) > Date.now() ? 'appointments.cancelDialog.bodyAhead' : 'appointments.cancelDialog.body'),
  confirmLabel: t('appointments.cancelDialog.confirm'),
  cancelLabel: t('appointments.cancelDialog.keep'),
  danger: true,
});
