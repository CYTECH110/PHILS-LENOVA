const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/config/database');

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('GET /api/health returns 200 with status ok', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.status, 'ok');
});

test('POST /api/auth/login with invalid credentials returns 401', async () => {
  const csrfResponse = await fetch(`${baseUrl}/api/csrf-token`);
  const { csrfToken } = await csrfResponse.json();
  const sessionCookie = csrfResponse.headers.get('set-cookie').split(';')[0];

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      Cookie: sessionCookie
    },
    body: JSON.stringify({ username: '__phase17_missing_user__', password: 'not-the-password' })
  });

  assert.equal(response.status, 401);

  const body = await response.json();
  assert.equal(body.success, false);
  assert.ok(body.error);
});

test('GET /api/admin/dashboard without a token returns 401', async () => {
  const response = await fetch(`${baseUrl}/api/admin/dashboard`);
  assert.equal(response.status, 401);

  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error, 'Authentication required');
});