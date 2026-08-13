// The CI lint gate (LT-039): hooks rules only.
//
// The full config in eslint.config.js still reports ~58 pre-existing errors
// (unused vars, explicit any) that predate any gate, so it cannot fail a
// deploy yet without a repo-wide cleanup — that debt is LT-040. This config
// enforces just the rules whose violations crash pages at runtime, the class
// of bug that took down /dashboard/portfolio in production.
//
// Delete this file and point CI at `npm run lint` once LT-040 lands.
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // tseslint's plugin is registered but none of its rules are enabled: the
    // codebase carries inline `eslint-disable @typescript-eslint/*` comments,
    // and a directive naming an unregistered rule is itself an error.
    plugins: { 'react-hooks': reactHooks, '@typescript-eslint': tseslint.plugin },
    rules: reactHooks.configs.recommended.rules,
  },
];
