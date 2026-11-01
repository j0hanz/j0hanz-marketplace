import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import deMorgan from 'eslint-plugin-de-morgan';
import regexp from 'eslint-plugin-regexp';
import globals from 'globals';

const sharedLanguageOptions = {
  parser: babelParser,
  parserOptions: {
    requireConfigFile: false,
    babelOptions: {
      presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
    },
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  globals: {
    ...globals.browser,
    ...globals.node,
  },
};

export default [
  {
    ignores: [
      'node_modules',
      'dist',
      'site/src/data',
      'plugins/telltale/.claude-plugin/types/**',
      'plugins/tutor/templates/assets/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: sharedLanguageOptions,
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // JS-only rules that fire spuriously on TS code under babel parser.
      'no-unused-vars': 'off',
      'no-undef': 'off',
      // Quality.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  deMorgan.configs.recommended,
  regexp.configs.recommended,
  {
    files: ['eslint.config.js', 'scripts/**/*.mjs', 'plugins/**/*.mjs'],
    languageOptions: {
      ...sharedLanguageOptions,
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-control-regex': 'off',
      'no-useless-assignment': 'off',
      'preserve-caught-error': 'off',
      ...Object.fromEntries(Object.keys(regexp.configs.recommended.rules).map((k) => [k, 'off'])),
    },
  },
  prettier,
];
