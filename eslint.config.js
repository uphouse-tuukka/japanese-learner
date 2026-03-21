import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import tseslint from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default [
  {
    ignores: ['node_modules/**', '.svelte-kit/**', 'build/**', 'dist/**', '.vercel/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        svelteConfig,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      'svelte/require-each-key': 'off',
      'svelte/no-navigation-without-resolve': 'off',
      'svelte/prefer-writable-derived': 'off',
      'svelte/prefer-svelte-reactivity': 'off',
    },
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  prettierConfig,
];
