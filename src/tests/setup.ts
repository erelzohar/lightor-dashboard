import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { restoreLocation } from './helpers/location';
import { typewriterConfig } from '../components/lighty/LightyTyped';

// Lighty's answers type themselves out (LT-271); tests read the finished
// text, and lightyTyped.test.tsx switches the typing back on.
typewriterConfig.enabled = false;

afterEach(() => {
  cleanup();
  localStorage.clear();
  restoreLocation();
});

// jsdom has no IntersectionObserver; framer's whileInView and NumberFlow ask for one (LT-512).
class NoIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('IntersectionObserver', NoIntersectionObserver);
