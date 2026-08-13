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
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
];
