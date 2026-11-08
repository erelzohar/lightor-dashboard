import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OfflineScreen from '../../components/auth/OfflineScreen';
import { useAuth } from '../../contexts/AuthContext';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const retryConnection = vi.fn();

beforeEach(() => {
  retryConnection.mockReset();
  vi.mocked(useAuth).mockReturnValue({ retryConnection } as never);
});

/** LT-614: the screen a signed-in owner sees when the app opens without a connection. */
describe('OfflineScreen (LT-614)', () => {
  it('says there is no connection and offers to try again', () => {
    render(<OfflineScreen />);

    expect(screen.getByRole('heading', { name: 'app.offline.title' })).toBeInTheDocument();
    expect(screen.getByText('app.offline.body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'app.offline.retry' })).toBeEnabled();
  });

  it('asks the server again on the button, and shows it is checking meanwhile', async () => {
    let answer: () => void = () => {};
    retryConnection.mockImplementation(() => new Promise<void>((resolve) => { answer = resolve; }));
    render(<OfflineScreen />);

    await userEvent.click(screen.getByRole('button', { name: 'app.offline.retry' }));

    expect(retryConnection).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'app.offline.checking' })).toBeDisabled();
    answer();
    await waitFor(() => expect(screen.getByRole('button', { name: 'app.offline.retry' })).toBeEnabled());
  });
});
