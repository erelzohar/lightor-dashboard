import { describe, it, expect, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { readFileSync } from 'fs';
import path from 'path';
import postcss from 'postcss';
import tailwindcss from 'tailwindcss';
import loadConfig from 'tailwindcss/loadConfig';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { hexToRgbChannels } from '../../lib/colorChannels';

/**
 * LT-280: `primary` was a bare var(--color-primary), so Tailwind silently
 * emitted nothing for bg-primary/10, border-primary/30 and every other
 * opacity modifier on the brand colour. It is now built from channels.
 */

const repo = path.resolve(__dirname, '../../..');
const indexCss = readFileSync(path.join(repo, 'src/index.css'), 'utf8');

/** The given classes compiled with the real tailwind.config.js. */
const compile = async (classes: string[]) => {
  const config = loadConfig(path.join(repo, 'tailwind.config.js'));
  const plugin = tailwindcss({ ...config, content: [{ raw: classes.join(' '), extension: 'html' }] });
  return (await postcss([plugin]).process('@tailwind utilities;', { from: undefined })).css;
};

const selector = (cls: string) => '.' + cls.replace(/[/:.[\]]/g, '\\$&');

/** `--name: value` pairs declared in index.css's :root block. */
const rootVars = () => {
  const block = /:root\s*{([^}]*)}/.exec(indexCss)?.[1] ?? '';
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
};

afterEach(() => {
  document.documentElement.removeAttribute('style');
});

describe('hexToRgbChannels', () => {
  it.each([
    ['#8b5cf6', '139 92 246'],
    ['#7C3AED', '124 58 237'],
    ['#fff', '255 255 255'],
    ['#f0f8', '255 0 255'],
    ['#8b5cf680', '139 92 246'],
    [' #8b5cf6 ', '139 92 246'],
  ])('%s → %s', (hex, channels) => {
    expect(hexToRgbChannels(hex)).toBe(channels);
  });

  it.each(['rgb(139, 92, 246)', 'violet', '#12345', '#ggg', ''])('%s is not read', (value) => {
    expect(hexToRgbChannels(value)).toBeNull();
  });
});

describe('the brand colour in Tailwind', () => {
  it('emits every opacity modifier, on primary and primary-dark', async () => {
    const classes = [
      'bg-primary/10',
      'border-primary/30',
      'hover:border-primary/40',
      'text-primary/70',
      'focus:ring-primary/20',
      'from-primary/5',
      'to-primary/[0.02]',
      'shadow-primary/20',
      'dark:bg-primary/20',
      'dark:border-primary-dark/30',
    ];
    const css = await compile(classes);
    for (const cls of classes) expect(css).toContain(selector(cls));
    expect(css).toContain('background-color: rgb(var(--color-primary-rgb) / 0.1)');
    expect(css).toContain('border-color: rgb(var(--color-primary-dark-rgb) / 0.3)');
  });

  it('keeps the solid colours fully opaque', async () => {
    const css = await compile(['bg-primary', 'text-primary', 'bg-primary-dark']);
    expect(css).toMatch(/\.bg-primary \{\s*--tw-bg-opacity: 1;\s*background-color: rgb\(var\(--color-primary-rgb\) \/ var\(--tw-bg-opacity\)\)/);
    expect(css).toMatch(/\.text-primary \{\s*--tw-text-opacity: 1;\s*color: rgb\(var\(--color-primary-rgb\) \/ var\(--tw-text-opacity\)\)/);
    expect(css).toContain('background-color: rgb(var(--color-primary-dark-rgb) / var(--tw-bg-opacity))');
  });
});

describe('the brand colour channels', () => {
  it('index.css declares channels that match each hex colour', () => {
    const vars = rootVars();
    const twins = Object.keys(vars).filter((name) => name.endsWith('-rgb'));
    expect(twins).toEqual(expect.arrayContaining(['--color-primary-rgb', '--color-primary-dark-rgb']));
    for (const twin of twins) {
      expect(hexToRgbChannels(vars[twin.replace(/-rgb$/, '')]), twin).toBe(vars[twin]);
    }
  });

  it('ThemeContext paints what index.css paints, and moves the channels with a new colour', () => {
    let theme: ReturnType<typeof useTheme> | undefined;
    const Grab = (): null => {
      theme = useTheme();
      return null;
    };
    render(<ThemeProvider><Grab /></ThemeProvider>);

    const style = document.documentElement.style;
    const vars = rootVars();
    for (const name of ['--color-primary', '--color-primary-dark', '--color-primary-rgb', '--color-primary-dark-rgb']) {
      expect(style.getPropertyValue(name), name).toBe(vars[name]);
    }

    act(() => theme!.updatePalette({ ...theme!.palette, colorPrimary: '#e11d48', colorPrimaryDark: '#be123c' }));
    expect(style.getPropertyValue('--color-primary')).toBe('#e11d48');
    expect(style.getPropertyValue('--color-primary-rgb')).toBe('225 29 72');
    expect(style.getPropertyValue('--color-primary-dark-rgb')).toBe('190 18 60');
  });
});
