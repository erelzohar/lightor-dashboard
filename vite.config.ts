import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

/**
 * LT-315: refuse a bundle that contains a regex lookbehind assertion. WebKit
 * before 16.4 cannot parse one, and the iOS app installs on 15.0+. esbuild
 * does not reject it for an older `build.target` — it rewrites the literal
 * into `new RegExp(…)`, which throws a SyntaxError when the chunk evaluates
 * — so one lookbehind in the main chunk was a white screen on those phones.
 * This checks the emitted code, dependencies included.
 */
const LOOKBEHIND = /\(\?<[=!]/;
const noRegexLookbehind = (): Plugin => ({
  name: 'lt315-no-regex-lookbehind',
  apply: 'build',
  generateBundle(_options, bundle) {
    for (const [name, output] of Object.entries(bundle)) {
      if (output.type === 'chunk' && LOOKBEHIND.test(output.code)) {
        this.error(`${name} contains a regex lookbehind, which iOS/Safari < 16.4 cannot parse (the app supports iOS 15). Rewrite it without one.`);
      }
    }
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), noRegexLookbehind()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
