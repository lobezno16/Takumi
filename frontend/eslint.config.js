import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      security,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      ...security.configs.recommended.rules,
      // Fires on every computed member access; all our dynamic keys are
      // internal constant tables (slot-code maps, color palettes, loop
      // indexes), never user input. Kept off to keep the remaining
      // security rules enforceable at --max-warnings 0.
      'security/detect-object-injection': 'off',
    },
  },
);
