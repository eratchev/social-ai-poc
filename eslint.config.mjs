// eslint.config.mjs
import next from 'eslint-config-next';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';

export default [
  // Base JS + TypeScript + Next rules
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  // Ignore generated/build artifacts
  {
    ignores: [
      'src/generated/**',
      '.next/**',
      'node_modules/**',
      'dist/**',
    ],
  },

  // Relax rules only for generated code
  {
    files: ['src/generated/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },
];
