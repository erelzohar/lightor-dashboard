import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useFirstTime, resetFirstTimes } from '../../hooks/useFirstTime';

/** LT-438: the home page's graphs draw themselves in once a session. */
const Probe = ({ id, k = 'graph' }: { id: string; k?: string }) => <span data-testid={id}>{String(useFirstTime(k))}</span>;

describe('useFirstTime', () => {
  beforeEach(() => resetFirstTimes());

  it('is true for the first ones to show together, and for their whole life; false for every later one', () => {
    const first = render(<><Probe id="a" /><Probe id="b" /></>);
    expect(screen.getByTestId('a')).toHaveTextContent('true');
    expect(screen.getByTestId('b')).toHaveTextContent('true');
    first.rerender(<><Probe id="a" /><Probe id="b" /></>);
    expect(screen.getByTestId('a')).toHaveTextContent('true');
    first.unmount();

    render(<><Probe id="c" /><Probe id="d" k="other" /></>);
    expect(screen.getByTestId('c')).toHaveTextContent('false');
    expect(screen.getByTestId('d')).toHaveTextContent('true');
  });
});

const loadAsync = vi.hoisted(() => vi.fn());
vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class { setMeshoptDecoder() {} loadAsync = loadAsync; },
}));

describe("Lighty's model (LT-438)", () => {
  it('is fetched once a session for every Lighty, and fetched again after a failed load', async () => {
    const { loadSource } = await import('../../components/lighty/Lighty3D');
    loadAsync.mockRejectedValueOnce(new Error('offline'));
    await expect(loadSource()).rejects.toThrow('offline');
    const scene = { traverse: () => {}, updateMatrixWorld: () => {}, getObjectByName: (): undefined => undefined };
    loadAsync.mockResolvedValue({ scene, animations: [] });
    const [a, b] = await Promise.all([loadSource(), loadSource()]);
    await loadSource();
    expect(a).toBe(b);
    expect(a.gltf.scene).toBe(scene);
    expect(loadAsync).toHaveBeenCalledTimes(2); // the failed try, then one for everyone
  });
});
