import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', '.desloppify/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.mjs', 'src/**/*.js'],
    languageOptions: { globals: { ...globals.browser, browser: 'readonly' } },
  },
  {
    files: ['src/experiments/**/*.mjs', 'src/experiments/**/*.js'],
    languageOptions: {
      globals: Object.fromEntries(
        ['ChromeUtils', 'Components', 'Services', 'Cc', 'Ci', 'Cr', 'Cu'].map((name) => [
          name,
          'readonly',
        ]),
      ),
    },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
  { rules: { 'no-unused-vars': ['error', { caughtErrors: 'none' }] } },
];
