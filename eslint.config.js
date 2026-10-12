'use strict';

const nodeGlobals = {
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  process: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  global: 'readonly',
  fetch: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  queueMicrotask: 'readonly'
};

const sharedRules = {
  'no-undef': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-args': 'error',
  'no-redeclare': 'error',
  'no-unreachable': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
  'no-empty': ['error', { allowEmptyCatch: true }],
  'no-func-assign': 'error',
  'no-self-assign': 'error',
  'valid-typeof': 'error',
  'use-isnan': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }]
};

module.exports = [
  {
    ignores: ['node_modules/**', 'archive/**', 'coverage/**', '**/*.min.js']
  },
  {
    files: ['*.js', 'server/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: nodeGlobals
    },
    rules: sharedRules
  }
];
