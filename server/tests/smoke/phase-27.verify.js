const bcrypt = require('bcrypt');
const app = require('../../src/app');
const pool = require('../../src/config/database');

const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok: Boolean(ok), detail });
}

const PASSWORD = 'Phase27-Password!';
const stamp = Date.now();
const ADMIN_USER = `__p27_admin_${stamp}`;
const TEACHER_A = `__p27_teacher_a_${stamp}`;
const TEACHER_B = `__p27_teacher_b_${stamp}`;
const STUDENT = `__p27_student_${stamp}`;
const QUIZ_A_TITLE = `Phase27 Quiz A ${stamp}`;
const QUIZ_B_TITLE = `Phase27 Quiz B ${stamp}`;

const tracked = { users: [], courses: [], quizzes: [] };
let server;
let base;

async function login(username, csrfCookie, csrfToken) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: csrfCookie, 'x-csrf-token': csrfToken },
    body: JSON.stringify({ username, password: PASSWORD })
  });
  return (response.headers.get('set-cookie') || '').split(';')[0];
}

async function getText(url, cookie) {
  const response = await fetch(`${base}${url}`, { headers: cookie ? { cookie } : {} });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

async function getBuffer(url, cookie) {
  const response = await fetch(`${base}${url}`, { headers: cookie ? { cookie } : {} });
  return { status: response.status, headers: response.headers, buffer: Buffer.from(await response.arrayBuffer()) };
}

async function main() {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const csrfRes = await fetch(`${base}/api/csrf-token`);
  const csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  const csrfToken = (await csrfRes.json()).csrfToken;

  const hash = await bcrypt.hash(PASSWORD, 12);
  const userIds = {};
  for (const [key, username, role] of [
    ['admin', ADMIN_USER, 'ADMIN'],
    ['teacherA', TEACHER_A, 'TEACHER'],
    ['teacherB', TEACHER_B, 'TEACHER'],
    ['student', STUDENT, 'STUDENT']
  ]) {
    const [result] = await pool.execute('INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)', [username, hash, username, role, `${username}@example.com`]);
    userIds[key] = result.insertId;
    tracked.users.push(result.insertId);
  }

  const [courseA] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', [`${QUIZ_A_TITLE} course`, 'p27']);
  const [courseB] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', [`${QUIZ_B_TITLE} course`, 'p27']);
  tracked.courses.push(courseA.insertId, courseB.insertId);
  await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?), (?, ?)', [userIds.teacherA, courseA.insertId, userIds.teacherB, courseB.insertId]);

  const [quizA] = await pool.execute("INSERT INTO quizzes (course_id, creator_id, title, duration_minutes, pass_mark, status) VALUES (?, ?, ?, 30, 50, 'PUBLISHED')", [courseA.insertId, userIds.teacherA, QUIZ_A_TITLE]);
  const [quizB] = await pool.execute("INSERT INTO quizzes (course_id, creator_id, title, duration_minutes, pass_mark, status) VALUES (?, ?, ?, 30, 50, 'PUBLISHED')", [courseB.insertId, userIds.teacherB, QUIZ_B_TITLE]);
  tracked.quizzes.push(quizA.insertId, quizB.insertId);

  await pool.execute("INSERT INTO quiz_attempts (quiz_id, student_id, score, status, passed, submitted_at) VALUES (?, ?, 3, 'SUBMITTED', 1, NOW())", [quizA.insertId, userIds.student]);
  await pool.execute("INSERT INTO quiz_attempts (quiz_id, student_id, score, status, passed, submitted_at) VALUES (?, ?, 1, 'SUBMITTED', 0, NOW())", [quizB.insertId, userIds.student]);

  const adminCookie = await login(ADMIN_USER, csrfCookie, csrfToken);
  const teacherACookie = await login(TEACHER_A, csrfCookie, csrfToken);
  const studentCookie = await login(STUDENT, csrfCookie, csrfToken);

  // ---- admin sees everything ----
  let res = await getText('/api/reports/attempts.csv', adminCookie);
  check('admin attempts.csv -> 200 text/csv', res.status === 200 && (res.headers.get('content-type') || '').includes('text/csv'), `status ${res.status}`);
  check('admin CSV has headers + both quizzes', res.text.includes('"Attempt","Student"') && res.text.includes(QUIZ_A_TITLE) && res.text.includes(QUIZ_B_TITLE));
  check('CSV Content-Disposition filename', /learnova-attempts-\d{4}-\d{2}-\d{2}\.csv/.test(res.headers.get('content-disposition') || ''), res.headers.get('content-disposition'));

  res = await getBuffer('/api/reports/attempts.xlsx', adminCookie);
  check('admin attempts.xlsx -> xlsx magic + type', res.status === 200 && (res.headers.get('content-type') || '').includes('spreadsheetml') && res.buffer.slice(0, 2).toString('latin1') === 'PK', `status ${res.status}`);

  res = await getBuffer('/api/reports/attempts.pdf', adminCookie);
  check('admin attempts.pdf -> pdf magic + type', res.status === 200 && res.headers.get('content-type') === 'application/pdf' && res.buffer.slice(0, 5).toString('latin1') === '%PDF-', `status ${res.status}`);

  res = await getText('/api/reports/quizzes.csv', adminCookie);
  check('admin quizzes.csv -> per-quiz summary', res.status === 200 && res.text.includes(QUIZ_A_TITLE) && res.text.includes('Pass Rate'), res.text.split('\n')[0]);

  res = await getText('/api/reports/students.csv', adminCookie);
  check('admin students.csv -> per-student summary', res.status === 200 && res.text.includes(STUDENT), res.text.split('\n')[0]);

  // ---- teacher scoping ----
  res = await getText('/api/reports/attempts.csv', teacherACookie);
  check('teacher A export -> 200', res.status === 200, `status ${res.status}`);
  check('teacher A export contains own quiz', res.text.includes(QUIZ_A_TITLE));
  check('teacher A export excludes other teacher quiz', !res.text.includes(QUIZ_B_TITLE));

  res = await getText('/api/reports/quizzes.csv', teacherACookie);
  check('teacher quiz summary scoped', res.status === 200 && res.text.includes(QUIZ_A_TITLE) && !res.text.includes(QUIZ_B_TITLE));

  // ---- auth / role matrix ----
  res = await getText('/api/reports/attempts.csv');
  check('reports without auth -> 401', res.status === 401, `status ${res.status}`);
  res = await getText('/api/reports/attempts.csv', studentCookie);
  check('reports as student -> 403', res.status === 403, `status ${res.status}`);
  res = await getText('/api/reports/attempts.xml', adminCookie);
  check('unsupported format -> 404', res.status === 404, `status ${res.status}`);

  const failed = checks.filter((entry) => !entry.ok);
  for (const entry of checks) {
    console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name}${entry.ok ? '' : ` :: ${entry.detail ?? ''}`}`);
  }
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

async function cleanup() {
  try {
    if (tracked.quizzes.length) {
      const quizPlaceholders = tracked.quizzes.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM quiz_attempts WHERE quiz_id IN (${quizPlaceholders})`, tracked.quizzes);
      await pool.execute(`DELETE FROM quiz_questions WHERE quiz_id IN (${quizPlaceholders})`, tracked.quizzes);
      await pool.execute(`DELETE FROM quizzes WHERE id IN (${quizPlaceholders})`, tracked.quizzes);
    }
    if (tracked.courses.length) {
      const coursePlaceholders = tracked.courses.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM teacher_courses WHERE course_id IN (${coursePlaceholders})`, tracked.courses);
      await pool.execute(`DELETE FROM courses WHERE id IN (${coursePlaceholders})`, tracked.courses);
    }
    if (tracked.users.length) {
      const userPlaceholders = tracked.users.map(() => '?').join(', ');
      await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (${userPlaceholders})`, tracked.users);
      await pool.execute(`DELETE FROM users WHERE id IN (${userPlaceholders})`, tracked.users);
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
