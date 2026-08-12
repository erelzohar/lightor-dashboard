import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { restoreLocation } from './helpers/location';

afterEach(() => {
  cleanup();
  localStorage.clear();
  restoreLocation();
});
