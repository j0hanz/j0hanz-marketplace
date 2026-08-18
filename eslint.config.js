import js from '@eslint/js';
import babelParser from '@babel/eslint-parser';
import react from 'eslint-plugin-react';
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
      'plugins/**',
      'scripts/build-site-data.mjs',
      'scripts/validate.mjs',
    ],
  },
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: sharedLanguageOptions,
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
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
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
    },
  },
  {
    files: ['eslint.config.js'],
    languageOptions: {
      ...sharedLanguageOptions,
      globals: { ...globals.node },
    },
  },
  deMorgan.configs.recommended,
  regexp.configs.recommended,
  prettier,
];
