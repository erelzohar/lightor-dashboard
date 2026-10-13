import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/segmented-tabs';

const { lightTick } = vi.hoisted(() => ({ lightTick: vi.fn() }));
vi.mock('../../lib/haptics', () => ({ lightTick, impact: vi.fn() }));

const Host = ({ onChange }: { onChange?: (v: string) => void }) => {
  const [v, setV] = useState('upload');
  return (
    <Tabs value={v} onValueChange={(next) => { setV(next); onChange?.(next); }}>
      <TabsList aria-label="Logo">
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="url">Link</TabsTrigger>
      </TabsList>
    </Tabs>
  );
};

/** LT-313 — the dashboard's segmented tabs: a press picks, with a tick. */
describe('the segmented tabs', () => {
  beforeEach(() => lightTick.mockClear());
  afterEach(() => document.documentElement.removeAttribute('dir'));

  it('picks on press, ticks once per change, and not for the tab already chosen', () => {
    const onChange = vi.fn();
    render(<Host onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Upload' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Link' }));
    expect(screen.getByRole('tab', { name: 'Link' })).toHaveAttribute('aria-selected', 'true');
    expect(onChange).toHaveBeenCalledWith('url');
    expect(lightTick).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Link' }));
    expect(lightTick).toHaveBeenCalledTimes(1);
  });

  it("follows the page's direction", () => {
    document.documentElement.dir = 'rtl';
    render(<Host />);
    expect(screen.getByRole('tablist', { name: 'Logo' }).closest('[dir]')).toHaveAttribute('dir', 'rtl');
  });
});
