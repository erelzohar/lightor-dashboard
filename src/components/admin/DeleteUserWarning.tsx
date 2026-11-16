import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fetchDeletionPreview, type AdminDeletionPreview } from '../../services/adminApi';
import { billsOnAfterDeletion } from '../../lib/storeLinks';

/**
 * LT-663 (Erel 2026-11-15): what the operator reads before deleting an
 * account. Deleting cancels a Paddle subscription first, but one bought in an
 * app is the store's: it goes on billing the owner until they cancel it
 * there, so the dialog says so instead of "any live subscription is
 * cancelled". And the bookings still ahead are deleted with nobody texted.
 *
 * `known` is what the page already holds (the account's subscription), shown
 * until the server answers and when it cannot.
 */
interface Props {
  userId: string;
  name: string;
  known: 'apple' | 'google' | null;
}

const DeleteUserWarning: React.FC<Props> = ({ userId, name, known }) => {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<AdminDeletionPreview | null>(null);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    fetchDeletionPreview(userId)
      .then((answer) => {
        if (alive) setPreview(answer);
      })
      .catch(() => {
        // The warning then goes by what the page knows.
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  // LT-668: a Google Play subscription's renewal is stopped by the deletion, as Paddle's is cancelled.
  const store = billsOnAfterDeletion(preview ? preview.storeSubscription : known);
  const storeName = t('billing.store.appStore');
  const futureBookings = preview?.futureBookings ?? 0;

  return (
    <span className="block space-y-2">
      <span className="block">{t(store ? 'admin.actions.deleteConfirmStore' : 'admin.actions.deleteConfirm', { name })}</span>
      {store && (
        <span
          role="alert"
          data-testid="admin-delete-store-warning"
          className="block rounded-lg border border-amber-300 bg-amber-50 p-2.5 font-medium text-amber-900 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-100"
        >
          {t('admin.actions.deleteStoreWarning', { store: storeName })}
        </span>
      )}
      {futureBookings > 0 && (
        <span className="block" data-testid="admin-delete-bookings-warning">
          {t('admin.actions.deleteBookingsWarning', { count: futureBookings })}
        </span>
      )}
    </span>
  );
};

export default DeleteUserWarning;
