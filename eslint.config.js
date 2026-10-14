import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const PURE_GLOBALS = [
  'document',
  'window',
  'localStorage',
  'sessionStorage',
  'navigator',
  'requestAnimationFrame',
].map((name) => ({ name, message: 'The pure sim modules are DOM-free.' }));

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'dist-single/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'public/icons/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.{mjs,js}'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['*.config.ts', 'build/**/*.ts'],
    extends: [...tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
  // Layering (docs/design/decisions.md): engine <- math <- strategy; none may import UI, scene or app.
  {
    files: ['src/sim/engine/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'preact',
                'preact/*',
                '../ui',
                '../ui/*',
                '../scene',
                '../scene/*',
                '../index',
                '../../*',
                '**/app/**',
                '**/sim/ui/**',
                '**/sim/scene/**',
                '../math',
                '../math/*',
                '../strategy',
                '../strategy/*',
              ],
              message: 'The engine imports nothing outside src/sim/engine.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...PURE_GLOBALS],
    },
  },
  {
    files: ['src/sim/math/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'preact',
                'preact/*',
                '../ui',
                '../ui/*',
                '../scene',
                '../scene/*',
                '../index',
                '../../*',
                '**/app/**',
                '**/sim/ui/**',
                '**/sim/scene/**',
                '../strategy',
                '../strategy/*',
              ],
              message: 'Math may import only the engine.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...PURE_GLOBALS],
    },
  },
  {
    files: ['src/sim/strategy/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'preact',
                'preact/*',
                '../ui',
                '../ui/*',
                '../scene',
                '../scene/*',
                '../index',
                '../../*',
                '**/app/**',
                '**/sim/ui/**',
                '**/sim/scene/**',
              ],
              message: 'Strategy may import only the engine and math.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...PURE_GLOBALS],
    },
  },
  prettier,
);
