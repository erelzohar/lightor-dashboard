import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';

const LINK = 'px-2.5 py-1.5 text-xs font-semibold text-white/80';

/**
 * LT-502: while an account builds its first site there is no navbar, so this
 * is its way out: the account page (where it can be deleted, as Apple asks of
 * an app) and back, and logging out.
 */
const BuildingBar: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const onAccount = pathname === '/account';

  return (
    // In the flow, above the page: floating, it lay over the wizard's own menu.
    <nav data-testid="building-bar" className="relative shrink-0 flex items-center justify-end gap-1 px-2 h-9 bg-black">
      <button type="button" className={LINK} onClick={() => navigate(onAccount ? '/design' : '/account')}>
        {t(onAccount ? 'onboarding.buildingBar.back' : 'onboarding.buildingBar.account')}
      </button>
      <button type="button" className={LINK} onClick={logout}>
        {t('onboarding.buildingBar.logout')}
      </button>
    </nav>
  );
};

export default BuildingBar;
