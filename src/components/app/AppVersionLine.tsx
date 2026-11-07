import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appVersion, type AppVersion } from '../../lib/liveUpdate';

/**
 * LT-608: which Lightor this is, for support: in the apps the store version
 * and build, and everywhere the dashboard update (its commit and date) -
 * an over-the-air update changes the second without the first.
 */
const AppVersionLine: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [version, setVersion] = useState<AppVersion | null>(null);

  useEffect(() => {
    let live = true;
    void appVersion().then((v) => { if (live) setVersion(v); });
    return () => { live = false; };
  }, []);

  if (!version) return null;
  const date = version.builtAt ? new Date(version.builtAt) : null;
  const bundle = t('app.version.bundle', {
    id: version.bundle.slice(0, 7),
    date: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(i18n.language) : '',
  });
  return (
    <p className="text-center text-xs text-gray-500 dark:text-gray-400" dir="auto" data-testid="app-version">
      {version.version ? `${t('app.version.app', { version: version.version, build: version.build })} · ` : ''}
      <bdi>{bundle}</bdi>
    </p>
  );
};

export default AppVersionLine;
