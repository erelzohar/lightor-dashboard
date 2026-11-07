import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Card from '../ui/Card';
import { getAppInstalls, type AppInstalls } from '../../services/adminApi';

/**
 * LT-608: which app versions are out there - installs seen in 30 days by
 * store version and build, and by the over-the-air bundle they run (the
 * newest published one marked).
 */
const AppInstallsCard: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<AppInstalls | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    getAppInstalls().then((d) => { if (live) setData(d); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  return (
    <Card animate={false} className="lg:col-span-2" data-testid="app-installs">
      <h3 className="font-semibold text-gray-900 dark:text-dark-text mb-1">{t('admin.appInstalls.title')}</h3>
      <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
        {data ? t('admin.appInstalls.subtitle', { count: data.total, days: data.days }) : failed ? t('admin.appInstalls.failed') : '…'}
      </p>
      {data && data.total > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs text-gray-500 dark:text-gray-400">
                <th className="pb-2 text-start font-medium">{t('admin.appInstalls.version')}</th>
                <th className="pb-2 text-end font-medium">{t('admin.appInstalls.installs')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
              {data.versions.map((v) => (
                <tr key={`${v.platform}-${v.version}-${v.build}`}>
                  <td className="py-1.5 text-gray-800 dark:text-gray-200">
                    <bdi>{v.platform === 'ios' ? 'iPhone' : 'Android'} {v.version} ({v.build})</bdi>
                    {data.minBuild?.[v.platform] && Number(v.build) < Number(data.minBuild[v.platform]) ? (
                      <span className="ms-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{t('admin.appInstalls.mustUpdate')}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-end font-semibold tabular-nums text-gray-800 dark:text-gray-200">{v.installs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <th className="pb-2 text-start font-medium">{t('admin.appInstalls.bundle')}</th>
                <th className="pb-2 text-end font-medium">{t('admin.appInstalls.installs')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/40">
              {data.bundles.map((b) => (
                <tr key={`${b.platform}-${b.bundle}`}>
                  <td className="py-1.5 text-gray-800 dark:text-gray-200">
                    <bdi dir="ltr">{b.bundle || '-'}</bdi>
                    {b.bundle && b.bundle === data.latest ? (
                      <span className="ms-2 rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-800 dark:bg-green-500/10 dark:text-green-300">{t('admin.appInstalls.latest')}</span>
                    ) : null}
                  </td>
                  <td className="py-1.5 text-end font-semibold tabular-nums text-gray-800 dark:text-gray-200">{b.installs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default AppInstallsCard;
