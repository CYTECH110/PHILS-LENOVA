const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');

test('application exports an Express app', () => {
  assert.equal(typeof app, 'function');
});
