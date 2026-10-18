/**
 * Lighty's page tours (LT-389). Erel 2026-10-18: guidance for new accounts
 * on entering each page, as a tour that marks parts of the page; every
 * account sees each page's tour once.
 *
 * A step names what it points at with `[data-tour="…"]` (or another stable
 * selector); the first one on screen wins, so a phone and a desktop can point
 * at different things. A step whose target is not on screen (an empty list,
 * a hidden tab, the app's own layout) is left out. A step with no target is
 * a card in the middle of the screen. Texts are `tour.<key>.title|body`.
 */
export interface TourStep {
  key: string;
  target?: string[];
}

export interface TourDef {
  id: string;
  steps: TourStep[];
}

const at = (...names: string[]): string[] => names.map((n) => (n.startsWith('[') ? n : `[data-tour="${n}"]`));

/** The tour of the page at `pathname`, for a booking or a leads site; null for none. */
export const tourFor = (pathname: string, leadsSite: boolean): TourDef | null => {
  switch (pathname) {
    case '/':
      return {
        id: 'home',
        steps: [
          { key: 'home.intro' },
          { key: 'home.setup', target: at('setup') },
          { key: leadsSite ? 'home.statsLeads' : 'home.stats', target: at('stats') },
          { key: 'home.nav', target: at('nav', '[data-testid="bottom-tab-bar"]') },
          { key: 'home.lighty', target: at('[data-testid="floating-lighty"]') },
        ],
      };
    case '/lighty':
      return {
        id: 'lighty',
        steps: [
          { key: 'lighty.input', target: at('lighty-input') },
          { key: 'lighty.chips', target: at('lighty-chips') },
        ],
      };
    case '/design':
      return {
        id: 'design',
        steps: [
          { key: 'design.preview', target: at('[data-testid="preview-box"]') },
          // Beside the preview on a computer; on a phone the tab bar is the editing menu (LT-380).
          { key: 'design.panel', target: at('editor-panel', '[data-testid="bottom-tab-bar"]') },
          { key: 'design.save', target: at('editor-save') },
        ],
      };
    case '/appointments':
      return {
        id: 'appointments',
        steps: [
          { key: 'appointments.calendar', target: at('calendar') },
          { key: 'appointments.view', target: at('view-toggle') },
          { key: 'appointments.new', target: at('new-appointment') },
        ],
      };
    case '/leads':
      return {
        id: 'leads',
        steps: [
          { key: 'leads.filters', target: at('lead-filters') },
          { key: 'leads.actions', target: at('lead-actions') },
          { key: 'leads.status', target: at('lead-status') },
        ],
      };
    case '/customers':
      return {
        id: 'customers',
        steps: [
          { key: leadsSite ? 'customers.addLeads' : 'customers.add', target: at('add-customer') },
          { key: 'customers.table', target: at('customers-table') },
          { key: 'customers.export', target: at('export-customers') },
        ],
      };
    case '/schedule-vacations':
      return {
        id: 'schedule',
        steps: [
          { key: leadsSite ? 'schedule.hoursLeads' : 'schedule.hours', target: at('hours') },
          { key: 'schedule.special', target: at('special-hours') },
          { key: 'schedule.vacations', target: at('vacations') },
        ],
      };
    case '/appointment-types':
      return {
        id: 'services',
        steps: [
          { key: 'services.new', target: at('new-service') },
          { key: 'services.list', target: at('services') },
        ],
      };
    case '/portfolio':
      return {
        id: 'gallery',
        steps: [
          { key: 'gallery.add', target: at('add-image') },
          { key: 'gallery.grid', target: at('images') },
        ],
      };
    case '/settings':
      return {
        id: 'settings',
        steps: [
          { key: leadsSite ? 'settings.tabsLeads' : 'settings.tabs', target: at('settings-tabs') },
          { key: 'settings.general', target: at('settings-general') },
        ],
      };
    case '/account':
      return {
        id: 'account',
        steps: [
          { key: 'account.notifications', target: at('notifications') },
          { key: 'account.billing', target: at('billing') },
          { key: 'account.tours', target: at('tours-card') },
        ],
      };
    default:
      return null;
  }
};
