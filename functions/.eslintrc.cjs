/* eslint-env node */
module.exports = {
  root: true,
  env: {
    node: true,
    es2020: true,
  },
  globals: {
    // TypeScript ambient namespaces used in type positions; no-undef does not
    // understand them without type-aware linting.
    React: 'readonly',
    JSX: 'readonly',
    NodeJS: 'readonly',
    BlobPart: 'readonly',
    FirebaseFirestore: 'readonly',
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  ignorePatterns: ['lib', 'node_modules', '.eslintrc.cjs'],
  rules: {
    // Bug detection — keep as errors (would have caught LOT 1 undefined refs)
    'no-undef': 'error',
    'no-unsafe-optional-chaining': 'error',

    // Stylistic / noisy on a never-linted codebase — warn
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/no-empty-function': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-inferrable-types': 'warn',
    '@typescript-eslint/no-namespace': 'warn',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-extra-semi': 'warn',
    'no-empty': 'warn',
    'no-useless-escape': 'warn',
    'no-useless-catch': 'warn',
    'no-control-regex': 'warn',
    'no-prototype-builtins': 'warn',
    'prefer-const': 'warn',
    'prefer-rest-params': 'warn',
    'no-case-declarations': 'warn',
    'no-inner-declarations': 'warn',
    'no-constant-condition': 'warn',
    'no-fallthrough': 'warn',
    'no-extra-boolean-cast': 'warn',
  },
};
