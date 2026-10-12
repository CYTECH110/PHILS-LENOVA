'use strict';

process.env.SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
process.env.SMTP_PORT = process.env.SMTP_PORT || '9';

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { makeJar, startServer, stopServer, request, ensureCsrf, login } = require('./helpers');

// Precomputed bcrypt hash for 'Phase21Verify#2026' so the suite skips hashing cost.
const PASSWORD = 'Phase21Verify#2026';
const HASH = '$2b$12$rXruURSmFnyPPARndIIKee7IhrIUsuS1Uv3dGu8dqirPNm9TE4l2u';

const USERNAMES = { admin: 'p29.auth.admin', teacher: 'p29.auth.teacher', student: 'p29.auth.student' };
const ids = { users: {} };
const sessions = {};
let server = null;
let baseUrl = null;

const MATRIX = [
  { path: '/api/admin/dashboard', allowed: ['ADMIN'] },
  { path: '/api/teacher/dashboard', allowed: ['TEACHER'] },
  { path: '/api/student/dashboard', allowed: ['STUDENT'] },
  { path: '/api/reports/attempts.csv', allowed: ['ADMIN', 'TEACHER'] }
];

test.before(async () => {
  ({ server, baseUrl } = await startServer());

  const usernames = Object.values(USERNAMES);
  await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username IN (${usernames.map(() => '?').join(',')}))`, usernames);
  await pool.execute(`DELETE FROM users WHERE username IN (${usernames.map(() => '?').join(',')})`, usernames);

  const spec = [
    ['admin', 'P29 Auth Admin', 'ADMIN'],
    ['teacher', 'P29 Auth Teacher', 'TEACHER'],
    ['student', 'P29 Auth Student', 'STUDENT']
  ];
  for (const [key, fullName, role] of spec) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [USERNAMES[key], HASH, fullName, role]
    );
    ids.users[key] = result.insertId;
    sessions[key] = await login(baseUrl, USERNAMES[key], PASSWORD);
    assert.equal(sessions[key].status, 200, `login ${USERNAMES[key]} -> ${sessions[key].status} ${sessions[key].text}`);
  }
});

test.after(async () => {
  try {
    const userIds = Object.values(ids.users);
    if (userIds.length) {
      const placeholders = userIds.map(() => '?').join(',');
      await pool.query(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, userIds);
      await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
    }
  } finally {
    await stopServer(server);
    await pool.end();
  }
});

test('csrf-token endpoint issues a token and sets the cookie', async () => {
  const jar = makeJar();
  const response = await request(baseUrl, 'GET', '/api/csrf-token', { jar });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.csrfToken);
  assert.equal(jar.get('learnova_csrf'), body.csrfToken);
});

test('GET /api/auth/me returns the signed-in user', async () => {
  const response = await request(baseUrl, 'GET', '/api/auth/me', { jar: sessions.admin.jar });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.user.role, 'ADMIN');
  assert.equal(body.user.username, USERNAMES.admin);
});

for (const { path, allowed } of MATRIX) {
  test(`${path} enforces the role matrix`, async () => {
    for (const role of ['ADMIN', 'TEACHER', 'STUDENT']) {
      const response = await request(baseUrl, 'GET', path, { jar: sessions[role.toLowerCase()].jar });
      if (allowed.includes(role)) {
        assert.equal(response.status, 200, `${path} as ${role}`);
      } else {
        assert.equal(response.status, 403, `${path} as ${role}`);
        const body = await response.json();
        assert.equal(body.error, 'Insufficient permissions');
      }
    }

    const anonJar = makeJar();
    await ensureCsrf(baseUrl, anonJar);
    const anonymous = await request(baseUrl, 'GET', path, { jar: anonJar });
    assert.equal(anonymous.status, 401, `${path} anonymous`);
    const body = await anonymous.json();
    assert.equal(body.error, 'Authentication required');
  });
}

test('logout requires authentication and CSRF', async () => {
  const freshJar = makeJar();
  const csrf = await ensureCsrf(baseUrl, freshJar);
  const noAuth = await request(baseUrl, 'POST', '/api/auth/logout', { jar: freshJar, csrf });
  assert.equal(noAuth.status, 401);

  const noCsrf = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
  assert.equal(noCsrf.status, 403);
});

test('mutating route rejects a missing CSRF header before auth', async () => {
  const response = await fetch(`${baseUrl}/api/admin/courses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: sessions.admin.jar.header() },
    body: JSON.stringify({ name: 'Should not be created' })
  });
  assert.equal(response.status, 403);
  const body = await response.json();
  assert.equal(body.error, 'Invalid CSRF token');
});

test('admin passes CSRF + auth and reaches validation (400)', async () => {
  const response = await request(baseUrl, 'POST', '/api/admin/courses', { jar: sessions.admin.jar, csrf: sessions.admin.csrf, body: {} });
  assert.equal(response.status, 400);
});

test('unknown API route returns a 404 envelope', async () => {
  const response = await request(baseUrl, 'GET', '/api/does-not-exist');
  assert.equal(response.status, 404);
  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error, 'Route not found - /api/does-not-exist');
});
