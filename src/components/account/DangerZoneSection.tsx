import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useTranslation } from 'react-i18next';
import DeleteAccountDialog from './DeleteAccountDialog';

/**
 * Account deletion (LT-031): the account page's card. The confirm step, with
 * the proof the server asks for, is DeleteAccountDialog (LT-634: the phone
 * step opens it too).
 */
const DangerZoneSection: React.FC = () => {
  const { t } = useTranslation();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Card className="border border-red-200 dark:border-red-900/50">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {t('danger.title')}
          </h2>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">{t('danger.desc')}</p>
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
