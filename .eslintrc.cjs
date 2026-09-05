module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: 'detect' } },
  ignorePatterns: ['dist', 'node_modules', 'supabase/functions/**'],
  rules: {
    // Segredo hardcodado e o erro mais caro deste projeto (CLAUDE.md, Seguranca).
    'no-restricted-syntax': [
      'error',
      {
        selector: "Literal[value=/^(eyJ|sk_live|sk_test|EAA)[A-Za-z0-9_.-]{12,}/]",
        message: 'Parece uma chave/token hardcodado. Use import.meta.env.VITE_* ou o Vault.',
      },
    ],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
  overrides: [
    { files: ['**/*.test.{js,jsx}'], env: { 'vitest-globals/env': true }, globals: { vi: 'readonly', describe: 'readonly', it: 'readonly', expect: 'readonly', beforeEach: 'readonly', afterEach: 'readonly' } },
  ],
}
