// eslint.config.mjs
import next from 'eslint-config-next';

export default [
  // 1) Ignore generated / build artifacts
  {
    ignores: [
      'src/generated/**',
      '.next/**',
      'node_modules/**',
      'dist/**',
    ],
  },

  // 2) Core Next + TypeScript + React rules
  ...next,

  // 3) Relax rules only for generated code
  {
    files: ['src/generated/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
    },
  },

  // 4) Allow anonymous default exports in config files
  {
    files: ['eslint.config.mjs', 'postcss.config.mjs'],
    rules: {
      'import/no-anonymous-default-export': 'off',
    },
  },

  // 5) Soften React Compiler rules: good to see, but don't fail CI
  {
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
];
