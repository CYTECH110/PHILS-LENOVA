const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const pool = require('../../src/config/database');
const { APP_BASE_URL, EMAIL_FROM } = require('../../src/config/env');
const emailService = require('../../src/services/email.service');

const sent = [];
emailService.setEmailTransport({
  sendMail: async (message) => {
    sent.push(message);
    return { messageId: `verify-${sent.length}` };
  }
});

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

const PASSWORD = 'Phase26-Password!';
const stamp = Date.now();
const ADMIN_USER = `__p26_admin_${stamp}`;
const STUDENT_USER = `__p26_student_${stamp}`;
const CREATED_USER = `__p26_created_${stamp}`;
const NO_EMAIL_USER = `__p26_noemail_${stamp}`;
const ADMIN_EMAIL = `admin.${stamp}@example.com`;
const STUDENT_EMAIL = `student.${stamp}@example.com`;
const CREATED_EMAIL = `created.${stamp}@example.com`;

const trackedUserIds = [];
let server;
let base;

async function main() {
  // ---- static / config checks ----
  const env = fs.readFileSync(path.join(__dirname, '../../src/config/env.js'), 'utf8');
  check('env.js declares SMTP_* + EMAIL_FROM + APP_BASE_URL', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM', 'APP_BASE_URL'].every((k) => env.includes(k)));
  check('env.js declares EMAIL_ENABLED guard', env.includes('EMAIL_ENABLED'));
  const svc = fs.readFileSync(path.join(__dirname, '../../src/services/email.service.js'), 'utf8');
  check('email.service.js reads no process.env directly', !svc.includes('process.env'));
  check('email.service.js exports sendPasswordResetEmail', svc.includes('sendPasswordResetEmail'));
  const example = fs.readFileSync(path.join(__dirname, '../../../.env.example'), 'utf8');
  check('.env.example documents SMTP_HOST + EMAIL_FROM', example.includes('SMTP_HOST=') && example.includes('EMAIL_FROM='));
  const admin = fs.readFileSync(path.join(__dirname, '../../src/controllers/admin.controller.js'), 'utf8');
  check('admin createUser accepts optional email + welcome email', admin.includes('requireOptionalEmail') && admin.includes('sendWelcomeEmail'));
  const auth = fs.readFileSync(path.join(__dirname, '../../src/controllers/auth.controller.js'), 'utf8');
  check('forgotPassword sends a reset email', auth.includes('sendPasswordResetEmail'));

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const csrfRes = await fetch(`${base}/api/csrf-token`);
  const csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  const csrfToken = (await csrfRes.json()).csrfToken;

  const hash = await bcrypt.hash(PASSWORD, 12);
  const [adminInsert] = await pool.execute('INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)', [ADMIN_USER, hash, 'Phase26 Admin', 'ADMIN', ADMIN_EMAIL]);
  trackedUserIds.push(adminInsert.insertId);
  const [studentInsert] = await pool.execute('INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)', [STUDENT_USER, hash, 'Phase26 Student', 'STUDENT', STUDENT_EMAIL]);
  trackedUserIds.push(studentInsert.insertId);

  const adminCookie = await login(ADMIN_USER, csrfCookie, csrfToken);
  const studentCookie = await login(STUDENT_USER, csrfCookie, csrfToken);

  // ---- welcome email on user create ----
  const beforeCreate = sent.length;
  let res = await post('/api/admin/users', { username: CREATED_USER, full_name: 'Created Student', password: PASSWORD, role: 'STUDENT', email: CREATED_EMAIL }, adminCookie, csrfCookie, csrfToken);
  check('admin createUser with email -> 201', res.status === 201, `status ${res.status}`);
  const createdId = res.body && res.body.id;
  if (createdId) trackedUserIds.push(createdId);
  check('created user stores the real email', res.body && res.body.email === CREATED_EMAIL, JSON.stringify(res.body));
  const welcome = sent.slice(beforeCreate);
  check('welcome email sent to the real address', welcome.length === 1 && welcome[0].to === CREATED_EMAIL, JSON.stringify(welcome.map((m) => m.to)));
  check('welcome email uses configured EMAIL_FROM', welcome[0] && welcome[0].from === EMAIL_FROM, welcome[0] && welcome[0].from);

  const beforeNoEmail = sent.length;
  res = await post('/api/admin/users', { username: NO_EMAIL_USER, full_name: 'No Email Student', password: PASSWORD, role: 'STUDENT' }, adminCookie, csrfCookie, csrfToken);
  check('admin createUser without email -> 201', res.status === 201, `status ${res.status}`);
  if (res.body && res.body.id) trackedUserIds.push(res.body.id);
  check('welcome email skipped when email absent', sent.length === beforeNoEmail, `${sent.length - beforeNoEmail} extra`);

  res = await post('/api/admin/users', { username: `${CREATED_USER}_dup`, full_name: 'Dup', password: PASSWORD, role: 'STUDENT', email: CREATED_EMAIL }, adminCookie, csrfCookie, csrfToken);
  check('duplicate email -> 409', res.status === 409, `status ${res.status}`);

  res = await post('/api/admin/users', { username: `${CREATED_USER}_bad`, full_name: 'Bad', password: PASSWORD, role: 'STUDENT', email: 'not-an-email' }, adminCookie, csrfCookie, csrfToken);
  check('invalid email -> 400', res.status === 400, `status ${res.status}`);

  // ---- password reset email (through the HTTP endpoint) ----
  const beforeReset = sent.length;
  res = await post('/api/auth/forgot-password', { email: CREATED_EMAIL }, adminCookie, csrfCookie, csrfToken);
  check('forgot-password -> 200 generic', res.status === 200 && res.body.success === true, JSON.stringify(res.body));
  const resetMsgs = sent.slice(beforeReset);
  check('reset email sent to the account email', resetMsgs.length === 1 && resetMsgs[0].to === CREATED_EMAIL, JSON.stringify(resetMsgs.map((m) => m.to)));

  const [tokenRows] = await pool.execute('SELECT token FROM password_reset_tokens WHERE user_id = ? ORDER BY id DESC LIMIT 1', [createdId]);
  const dbToken = tokenRows[0] && tokenRows[0].token;
  const expectedLink = `${APP_BASE_URL.replace(/\/+$/, '')}/reset-password?token=${dbToken}`;
  check('reset email body contains the APP_BASE_URL reset link', Boolean(dbToken) && resetMsgs[0] && resetMsgs[0].text.includes(expectedLink), expectedLink);

  // ---- auth / role / CSRF matrix ----
  res = await post('/api/admin/users', { username: `${CREATED_USER}_x`, full_name: 'X', password: PASSWORD, role: 'STUDENT' }, null, csrfCookie, csrfToken);
  check('createUser without auth -> 401', res.status === 401, `status ${res.status}`);
  res = await post('/api/admin/users', { username: `${CREATED_USER}_y`, full_name: 'Y', password: PASSWORD, role: 'STUDENT' }, studentCookie, csrfCookie, csrfToken);
  check('createUser as student -> 403', res.status === 403, `status ${res.status}`);
  res = await post('/api/admin/users', { username: `${CREATED_USER}_z`, full_name: 'Z', password: PASSWORD, role: 'STUDENT' }, adminCookie, csrfCookie, null);
  check('createUser without CSRF -> 403', res.status === 403, `status ${res.status}`);

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.ok ? '' : ` :: ${c.detail}`}`);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

async function login(username, csrfCookie, csrfToken) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ username, password: PASSWORD })
  });
  const setCookie = response.headers.get('set-cookie') || '';
  const jwt = setCookie.split(';')[0];
  return `${jwt}`;
}

async function post(url, body, authCookie, csrfCookie, csrfToken) {
  const cookie = [authCookie, csrfCookie].filter(Boolean).join('; ');
  const headers = { 'content-type': 'application/json', cookie };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(`${base}${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const text = await response.text();
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  return { status: response.status, body: parsed };
}

async function cleanup() {
  try {
    if (trackedUserIds.length) {
      const placeholders = trackedUserIds.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM password_reset_tokens WHERE user_id IN (${placeholders})`, trackedUserIds);
      await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, trackedUserIds);
      await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, trackedUserIds);
    }
  } catch (error) {
    console.error('cleanup warning:', error.message);
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    await cleanup();
    await pool.end();
    if (server) server.close();
  });
