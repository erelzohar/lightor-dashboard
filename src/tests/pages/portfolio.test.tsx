import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Portfolio from '../../pages/Portfolio';

/**
 * The portfolio page mounts before its web config has arrived (LT-039).
 *
 * The page bails out to a spinner while the config loads, so every hook it
 * calls has to sit above that early return. A `useState` that drifted below it
 * — the Facebook token, added with the import feature — meant the second
 * render called one more hook than the first, and React tore the whole
 * dashboard down with minified error #300 the moment the config landed.
 */

type WebConfig = {
    _id: string;
    components: { portfolio: { items: { url: string; title: string }[]; visible: boolean } };
};

let state: { webConfig: { data: WebConfig | null; loading: boolean } };

vi.mock('../../hooks/useAppSelector', () => ({
    useAppSelector: (selector: (s: typeof state) => unknown) => selector(state),
}));
vi.mock('../../hooks/useAppDispatch', () => ({
    useAppDispatch: () => vi.fn().mockResolvedValue({ type: 'ok' }),
}));
vi.mock('../../contexts/AuthContext', () => ({
    useAuth: () => ({ auth: { user: { webConfig_id: 'wc1' } } }),
}));
vi.mock('../../store/slices/webConfigSlice', () => ({
    fetchWebConfig: vi.fn(() => ({ type: 'fetch' })),
    updateWebConfig: Object.assign(vi.fn(() => ({ type: 'update' })), {
        rejected: { match: () => false },
    }),
}));
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('react-facebook-login/dist/facebook-login-render-props', () => ({
    default: ({ render }: { render: (p: { onClick: () => void }) => unknown }): unknown =>
        render({ onClick: () => {} }),
}));
vi.mock('../../components/portfolio/FacebookPhotoPicker', () => ({ default: (): null => null }));
vi.mock('../../components/portfolio/SortableImageItem', () => ({
    default: ({ item }: { item: { url: string } }) => <div data-testid="item">{item.url}</div>,
}));
vi.mock('../../services/imagesApi', () => ({ uploadImage: vi.fn(), importImageFromUrl: vi.fn() }));
vi.mock('browser-image-compression', () => ({ default: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const loaded: WebConfig = {
    _id: 'wc1',
    components: { portfolio: { items: [{ url: 'a.jpg', title: '' }], visible: true } },
};

describe('Portfolio', () => {
    beforeEach(() => {
        state = { webConfig: { data: null, loading: true } };
    });

    it('survives the config arriving after the loading spinner', () => {
        const { rerender } = render(<Portfolio />);
        expect(screen.queryByTestId('item')).toBeNull();

        state = { webConfig: { data: loaded, loading: false } };
        rerender(<Portfolio />);

        expect(screen.getByTestId('item')).toHaveTextContent('a.jpg');
    });

    it('renders the grid when the config is already in the store', () => {
        state = { webConfig: { data: loaded, loading: false } };

        render(<Portfolio />);

        expect(screen.getByTestId('item')).toHaveTextContent('a.jpg');
    });
});
