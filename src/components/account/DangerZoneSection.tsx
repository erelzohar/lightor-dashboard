import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';
import DeleteAccountDialog from './DeleteAccountDialog';
import { billsOnAfterDeletion, storeOfAccount } from '../../lib/storeLinks';
import { useAuth } from '../../contexts/AuthContext';

/**
 * Account deletion (LT-031): the account page's card. The confirm step, with
 * the proof the server asks for, is DeleteAccountDialog (LT-634: the phone
 * step opens it too).
 */
const DangerZoneSection: React.FC = () => {
  const { t } = useTranslation();
  const { auth } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  // LT-663: a subscription bought in an app is not cancelled by the delete.
  // LT-668: a Google Play subscription is cancelled with the account; the App Store's bills on.
  const store = billsOnAfterDeletion(storeOfAccount(auth.user));

  return (
    <Card className="border border-red-200 dark:border-red-900/50">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('danger.title')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {store
            ? t('danger.descStore', { store: t('billing.store.appStore') })
            : t('danger.desc')}
        </p>
        <div>
          <Button variant="danger" size="sm" onClick={() => setModalOpen(true)}>
            <span className="flex items-center gap-2">
              <Trash2 size={16} />
              {t('danger.deleteCta')}
            </span>
          </Button>
        </div>
      </div>

      {modalOpen && <DeleteAccountDialog onClose={() => setModalOpen(false)} />}
    </Card>
  );
};

export default DangerZoneSection;
