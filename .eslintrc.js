module.exports = {
  root: true,
  env: { node: true, es2022: true, browser: true },
  parserOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': ['warn', { argsIgnorePattern: 'next|_res|_req' }],
    'no-console': 'off',
    'no-undef': 'error',
    'prefer-const': 'warn',
  },
  ignorePatterns: ['node_modules/', 'src/public/', 'logs/'],
};
