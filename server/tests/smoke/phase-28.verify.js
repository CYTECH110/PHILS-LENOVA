const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const pool = require('../../src/config/database');

const ROOT = path.resolve(__dirname, '../../..');
const DIST_INDEX = path.join(ROOT, 'client-react', 'dist', 'index.html');
const uploadFile = path.join(ROOT, 'uploads', `__phase28_probe_${Date.now()}.txt`);

const PASSWORD = 'Phase28-Password!';
const stamp = Date.now();
const ROLE_USERS = {
  admin: { username: `__p28_admin_${stamp}`, role: 'ADMIN', path: '/admin' },
  teacher: { username: `__p28_teacher_${stamp}`, role: 'TEACHER', path: '/teacher' },
  student: { username: `__p28_student_${stamp}`, role: 'STUDENT', path: '/student' }
};
const trackedUsers = [];

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

let server;
let base;

async function get(url, cookie) {
  const response = await fetch(`${base}${url}`, { headers: cookie ? { cookie } : {} });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

async function getJson(url, cookie) {
  const { status, text } = await get(url, cookie);
  let body = null;
  try { body = JSON.parse(text); } catch { body = null; }
  return { status, body };
}

async function login(username, csrfCookie, csrfToken) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ username, password: PASSWORD })
  });
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

async function main() {
  // ---- unification: legacy client retired, archived (with a README) ----
  check('legacy client/ no longer in the project root', !fs.existsSync(path.join(ROOT, 'client')));
  check('legacy client archived for audit', fs.existsSync(path.join(ROOT, 'archive', 'phase28', 'legacy-client', 'index.html')));
  check('archive/phase28 has a README', fs.existsSync(path.join(ROOT, 'archive', 'phase28', 'README.md')));

  // ---- build pipeline: production SPA bundle exists ----
  check('frontend build exists (client-react/dist/index.html)', fs.existsSync(DIST_INDEX), 'run "npm run build"');

  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  // ---- API still guarded after static mounts ----
  let res = await get('/api/health');
  check('GET /api/health -> 200', res.status === 200, `status ${res.status}`);
  check('health body reports status=ok', res.text.includes('"status":"ok"'), res.text.slice(0, 80));

  res = await get('/api/admin/dashboard');
  check('GET /api/admin/dashboard without auth -> 401', res.status === 401, `status ${res.status}`);

  res = await get('/api/reports/attempts.csv');
  check('GET /api/reports/attempts.csv without auth -> 401', res.status === 401, `status ${res.status}`);

  const missing = await getJson('/api/does-not-exist');
  check('unknown API route -> 404 JSON envelope', missing.status === 404 && missing.body && missing.body.success === false, `status ${missing.status}`);

  // ---- SPA is served from the build (app.js:58-79 fallback) ----
  res = await get('/');
  const contentType = res.headers.get('content-type') || '';
  check('GET / -> 200 text/html', res.status === 200 && contentType.includes('text/html'), `status ${res.status} (${contentType})`);
  check('GET / serves the SPA shell', res.text.includes('id="root"'), res.text.slice(0, 60));

  const assetMatch = res.text.match(/src="(\/assets\/[^"]+\.js)"/);
  check('SPA shell references a hashed bundle', Boolean(assetMatch), assetMatch && assetMatch[1]);
  let bundleText = '';
  if (assetMatch) {
    const asset = await get(assetMatch[1]);
    const assetType = asset.headers.get('content-type') || '';
    check('bundle asset -> 200 javascript', asset.status === 200 && assetType.includes('javascript'), `status ${asset.status} (${assetType})`);
    bundleText = asset.text;
  }
  check('bundle compiles the three role routes', ['/admin', '/teacher', '/student'].every((p) => bundleText.includes(p)), 'route literals in dist bundle');

  // ---- client-side routing fallback ----
  res = await get('/admin/dashboard');
  check('deep link /admin/dashboard -> SPA fallback (index.html)', res.status === 200 && res.text.includes('id="root"'), `status ${res.status}`);

  res = await get('/api/does-not-exist/too');
  check('unknown API path is never the SPA fallback', res.status === 404, `status ${res.status}`);

  // ---- /uploads static mount still works ----
  fs.writeFileSync(uploadFile, 'phase28-uploads-probe');
  const upload = await get(`/uploads/${path.basename(uploadFile)}`);
  check('/uploads serves an uploaded file -> 200', upload.status === 200, `status ${upload.status}`);
  check('/uploads returns the file contents', upload.text === 'phase28-uploads-probe', upload.text.slice(0, 40));

  // ---- login -> all three role dashboards render from the built bundle ----
  const csrfRes = await fetch(`${base}/api/csrf-token`);
  const csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  const csrfToken = (await csrfRes.json()).csrfToken;

  const hash = await bcrypt.hash(PASSWORD, 12);
  for (const { username, role } of Object.values(ROLE_USERS)) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, hash, `Phase28 ${role}`, role]
    );
    trackedUsers.push(result.insertId);
  }

  for (const key of Object.keys(ROLE_USERS)) {
    const { username, role, path: dashboardPath } = ROLE_USERS[key];
    const cookie = await login(username, csrfCookie, csrfToken);
    check(`${key} login -> session cookie`, Boolean(cookie), cookie || 'no set-cookie');

    const me = await getJson('/api/auth/me', cookie);
    check(`${key} session role = ${role}`, me.status === 200 && me.body && me.body.user && me.body.user.role === role, `status ${me.status}`);

    const dashboard = await get(dashboardPath);
    check(`${key} dashboard ${dashboardPath} serves the SPA shell`, dashboard.status === 200 && dashboard.text.includes('id="root"'), `status ${dashboard.status}`);
  }
}

async function cleanup() {
  try {
    fs.rmSync(uploadFile, { force: true });
  } catch (error) {
    console.error('cleanup warning:', error.message);
  }
  try {
    if (trackedUsers.length) {
      const placeholders = trackedUsers.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, trackedUsers);
      await pool.execute(`DELETE FROM users WHERE id IN (${placeholders})`, trackedUsers);
    }
  } catch (error) {
    console.error('cleanup warning:', error.message);
  }
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    const failed = checks.filter((c) => !c.ok);
    for (const c of checks) {
      console.log(`${c.ok ? 'PASS' : 'FAIL'} ${c.name}${c.detail ? ' :: ' + c.detail : ''}`);
    }
    console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
    if (failed.length) process.exitCode = 1;
    await cleanup();
    await pool.end().catch((error) => console.error('cleanup warning:', error.message));
    if (server) server.close();
  });
