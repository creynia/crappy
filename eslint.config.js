import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

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
  {
    // Engine, math and strategy are pure: no UI framework, no DOM, no upward imports.
    files: ['src/sim/engine/**/*.ts', 'src/sim/math/**/*.ts', 'src/sim/strategy/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['preact', 'preact/*', '**/sim/ui/**', '**/sim/scene/**', '**/app/**'],
              message: 'Pure sim modules must not import UI, scene or app code.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'document', message: 'The pure sim modules are DOM-free.' },
        { name: 'window', message: 'The pure sim modules are DOM-free.' },
      ],
    },
  },
  prettier,
);
