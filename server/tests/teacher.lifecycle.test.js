process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '9';

const test = require('node:test');
const assert = require('node:assert');
const pool = require('../src/config/database');
const app = require('../src/app');
const { redisClient } = require('../src/config/redis');

const PASSWORD = 'Phase21Verify#2026';
const HASH = '$2b$12$rXruURSmFnyPPARndIIKee7IhrIUsuS1Uv3dGu8dqirPNm9TE4l2u';
const CLASS_LAT = 5.6037;
const CLASS_LNG = -0.1870;

const ids = { users: {}, quizzes: {}, questions: {} };
let baseUrl = null;
let server = null;

function makeJar() {
  const jar = new Map();
  return {
    setFrom(response) {
      const cookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
      for (const raw of cookies) {
        const [pair] = raw.split(';');
        const idx = pair.indexOf('=');
        jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      }
    },
    header() {
      return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    }
  };
}

async function call(jar, method, pathName, body) {
  const headers = { cookie: jar.header() };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(`${baseUrl}${pathName}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  jar.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

async function ensureCsrf(jar) {
  const res = await call(jar, 'GET', '/api/csrf-token');
  return res.json && res.json.csrfToken ? res.json.csrfToken : null;
}

async function mutating(jar, csrf, method, pathName, body) {
  const headers = { cookie: jar.header(), 'x-csrf-token': csrf, 'content-type': 'application/json' };
  const res = await fetch(`${baseUrl}${pathName}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  jar.setFrom(res);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not json */ }
  return { status: res.status, json };
}

async function login(username) {
  const jar = makeJar();
  const csrf = await ensureCsrf(jar);
  const res = await mutating(jar, csrf, 'POST', '/api/auth/login', { username, password: PASSWORD });
  assert.strictEqual(res.status, 200, `login ${username} -> ${res.status}`);
  return { jar, csrf };
}

test.before(async () => {
  server = app.listen(0);
  baseUrl = `http://localhost:${server.address().port}`;

  for (const [key, username, fullName, role] of [
    ['teacher', 'phase24.teacher', 'Phase 24 Teacher', 'TEACHER'],
    ['teacher2', 'phase24.teacher2', 'Phase 24 Teacher Two', 'TEACHER'],
    ['student', 'phase24.student', 'Phase 24 Student', 'STUDENT'],
    ['student2', 'phase24.student2', 'Phase 24 Student Two', 'STUDENT']
  ]) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, HASH, fullName, role]
    );
    ids.users[key] = result.insertId;
  }
  await pool.query('INSERT IGNORE INTO teacher_courses (teacher_id, course_id) VALUES (?, 1)', [ids.users.teacher]);
  await pool.query('INSERT IGNORE INTO teacher_classes (teacher_id, class_id) VALUES (?, 1)', [ids.users.teacher]);
  await pool.query('INSERT IGNORE INTO student_classes (student_id, class_id) VALUES (?, 1)', [ids.users.student]);

  const questionSpecs = [
    ['q1', 'MULTIPLE_CHOICE', 'What is 2+2?', '{"options":["3","4","5"],"correct_answer":"4"}', 'EASY'],
    ['q2', 'TRUE_FALSE', 'The sky is blue.', '{"correct_answer":"TRUE"}', 'EASY'],
    ['q3', 'SHORT_ANSWER', 'Capital of the Philippines?', '{"correct_answer":"Manila"}', 'MEDIUM'],
    ['q4', 'TRUE_FALSE', 'Grass is purple.', '{"correct_answer":"FALSE"}', 'EASY'],
    ['q5', 'MULTIPLE_CHOICE', 'Free question?', '{"options":["A","B"],"correct_answer":"A"}', 'MEDIUM']
  ];
  for (const [key, type, text, data, difficulty] of questionSpecs) {
    const [result] = await pool.execute(
      'INSERT INTO question_bank (teacher_id, question_type, question_text, answer_data, difficulty) VALUES (?, ?, ?, ?, ?)',
      [ids.users.teacher, type, text, data, difficulty]
    );
    ids.questions[key] = result.insertId;
  }
  const [q6] = await pool.execute(
    "INSERT INTO question_bank (teacher_id, question_type, question_text, answer_data, difficulty) VALUES (?, 'MULTIPLE_CHOICE', 'Foreign question?', '{\"options\":[\"X\",\"Y\"],\"correct_answer\":\"X\"}', 'MEDIUM')",
    [ids.users.teacher2]
  );
  ids.questions.q6 = q6.insertId;

  for (const [key, title, status] of [
    ['quizA', 'P24 Quiz A', 'DRAFT'],
    ['quizB', 'P24 Quiz B (attempted)', 'PUBLISHED'],
    ['quizC', 'P24 Quiz C', 'DRAFT']
  ]) {
    const [result] = await pool.execute(
      "INSERT INTO quizzes (course_id, creator_id, title, status, duration_minutes, pass_mark) VALUES (1, ?, ?, ?, 10, 50)",
      [ids.users.teacher, title, status]
    );
    ids.quizzes[key] = result.insertId;
    await pool.query('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, 1)', [result.insertId]);
  }

  await pool.query('INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES (?, ?, 1)', [ids.quizzes.quizB, ids.questions.q4]);

  const [attempt] = await pool.execute(
    "INSERT INTO quiz_attempts (quiz_id, student_id, status, score, submitted_at, passed) VALUES (?, ?, 'SUBMITTED', 1, NOW(), 0)",
    [ids.quizzes.quizB, ids.users.student]
  );
  await pool.query(
    'INSERT INTO quiz_attempt_answers (attempt_id, question_id, answer_text, is_correct, points) VALUES (?, ?, ?, 1, 1)',
    [attempt.insertId, ids.questions.q4, 'FALSE']
  );
});

test.after(async () => {
  try {
    await cleanup();
  } finally {
    if (server) server.close();
    await pool.end();
    try { redisClient.quit(); } catch { /* already disconnected */ }
  }
});

test('teacher quiz update + delete happy path (with audit trail)', async () => {
  const { jar, csrf } = await login('phase24.teacher');

  const updated = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizC}`, {
    title: 'P24 Renamed Quiz',
    duration_minutes: 20,
    pass_mark: 75,
    access_code: '',
    ends_at: null
  });
  assert.strictEqual(updated.status, 200, updated.text);
  assert.strictEqual(updated.json.quiz.title, 'P24 Renamed Quiz');
  assert.strictEqual(Number(updated.json.quiz.pass_mark), 75);
  assert.strictEqual(updated.json.quiz.access_code, null);

  const detail = await call(jar, 'GET', `/api/teacher/quizzes/${ids.quizzes.quizC}`);
  assert.strictEqual(detail.json.quiz.title, 'P24 Renamed Quiz');
  assert.strictEqual(detail.json.quiz.duration_minutes, 20);

  const badDuration = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizC}`, { duration_minutes: 0 });
  assert.strictEqual(badDuration.status, 400);
  const badPassMark = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizC}`, { pass_mark: 120 });
  assert.strictEqual(badPassMark.status, 400);
  const noFields = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizC}`, { nonsense: true });
  assert.strictEqual(noFields.status, 400);
  const invertedWindow = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizC}`, { starts_at: '2030-01-01T10:00', ends_at: '2029-01-01T10:00' });
  assert.strictEqual(invertedWindow.status, 400);

  const deleted = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizC}`);
  assert.strictEqual(deleted.status, 200);
  assert.strictEqual(deleted.json.deleted, true);
  const gone = await call(jar, 'GET', `/api/teacher/quizzes/${ids.quizzes.quizC}`);
  assert.strictEqual(gone.status, 404);
  const goneAgain = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizC}`);
  assert.strictEqual(goneAgain.status, 404);

  const [audit] = await pool.query("SELECT DISTINCT action FROM audit_logs WHERE user_id = ? AND action IN ('QUIZ_UPDATE','QUIZ_DELETE')", [ids.users.teacher]);
  assert.deepStrictEqual(audit.map((row) => row.action).sort(), ['QUIZ_DELETE', 'QUIZ_UPDATE']);
});

test('quiz edit/delete refused after submitted attempts, ownership enforced, answered questions locked', async () => {
  const { jar, csrf } = await login('phase24.teacher');
  const other = await login('phase24.teacher2');

  const foreignPut = await mutating(other.jar, other.csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizB}`, { title: 'Takeover' });
  assert.strictEqual(foreignPut.status, 404);
  const foreignDelete = await mutating(other.jar, other.csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizB}`);
  assert.strictEqual(foreignDelete.status, 404);

  const putSubmitted = await mutating(jar, csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizB}`, { title: 'Should refuse' });
  assert.strictEqual(putSubmitted.status, 409);
  const deleteSubmitted = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizB}`);
  assert.strictEqual(deleteSubmitted.status, 409);

  const answeredPut = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q4}`, { question_text: 'Changed' });
  assert.strictEqual(answeredPut.status, 409);
  const answeredDelete = await mutating(jar, csrf, 'DELETE', `/api/teacher/question-bank/${ids.questions.q4}`);
  assert.strictEqual(answeredDelete.status, 409);
});

test('attach/detach questions with duplicate + foreign guards', async () => {
  const { jar, csrf } = await login('phase24.teacher');
  const other = await login('phase24.teacher2');

  const attach1 = await mutating(jar, csrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions`, { question_id: ids.questions.q1 });
  assert.strictEqual(attach1.status, 201, attach1.text);
  const duplicate = await mutating(jar, csrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions`, { question_id: ids.questions.q1 });
  assert.strictEqual(duplicate.status, 409);
  for (const questionId of [ids.questions.q2, ids.questions.q3]) {
    const attached = await mutating(jar, csrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions`, { question_id: questionId });
    assert.strictEqual(attached.status, 201);
  }
  const foreign = await mutating(jar, csrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions`, { question_id: ids.questions.q6 });
  assert.strictEqual(foreign.status, 404);

  const detached = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions/${ids.questions.q2}`);
  assert.strictEqual(detached.status, 200);
  assert.strictEqual(detached.json.removed, true);
  const detachedAgain = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions/${ids.questions.q2}`);
  assert.strictEqual(detachedAgain.status, 404);

  const foreignDetach = await mutating(other.jar, other.csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions/${ids.questions.q1}`);
  assert.strictEqual(foreignDetach.status, 404);

  const detachOnSubmitted = await mutating(jar, csrf, 'DELETE', `/api/teacher/quizzes/${ids.quizzes.quizB}/questions/${ids.questions.q4}`);
  assert.strictEqual(detachOnSubmitted.status, 409);

  const reattach = await mutating(jar, csrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/questions`, { question_id: ids.questions.q2 });
  assert.strictEqual(reattach.status, 201);

  const [audit] = await pool.query('SELECT 1 FROM audit_logs WHERE user_id = ? AND action = ? LIMIT 1', [ids.users.teacher, 'QUESTION_DETACH']);
  assert.strictEqual(audit.length, 1, 'detach is audit-logged');
});

test('question bank update/delete ownership, validation, and attached guards', async () => {
  const other = await login('phase24.teacher2');
  const otherPut = await mutating(other.jar, other.csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q1}`, { question_text: 'Nope' });
  assert.strictEqual(otherPut.status, 404);
  const otherDelete = await mutating(other.jar, other.csrf, 'DELETE', `/api/teacher/question-bank/${ids.questions.q5}`);
  assert.strictEqual(otherDelete.status, 404);

  const { jar, csrf } = await login('phase24.teacher');
  const textUpdate = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q1}`, { question_text: 'What is two plus two?' });
  assert.strictEqual(textUpdate.status, 200, textUpdate.text);
  const typeWithoutAnswer = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q5}`, { question_type: 'TRUE_FALSE' });
  assert.strictEqual(typeWithoutAnswer.status, 400);
  const typeChange = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q5}`, { question_type: 'TRUE_FALSE', answer_data: { correct_answer: 'TRUE' } });
  assert.strictEqual(typeChange.status, 200);
  const badAnswerData = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q5}`, { answer_data: { options: ['OnlyOne'] } });
  assert.strictEqual(badAnswerData.status, 400);
  const badType = await mutating(jar, csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q5}`, { question_type: 'ESSAY' });
  assert.strictEqual(badType.status, 400);

  const attachedDelete = await mutating(jar, csrf, 'DELETE', `/api/teacher/question-bank/${ids.questions.q3}`);
  assert.strictEqual(attachedDelete.status, 409);
  const freeDelete = await mutating(jar, csrf, 'DELETE', `/api/teacher/question-bank/${ids.questions.q5}`);
  assert.strictEqual(freeDelete.status, 200);

  const [audit] = await pool.query("SELECT DISTINCT action FROM audit_logs WHERE user_id = ? AND action IN ('QUESTION_UPDATE','QUESTION_DELETE') ORDER BY action", [ids.users.teacher]);
  assert.deepStrictEqual(audit.map((row) => row.action), ['QUESTION_DELETE', 'QUESTION_UPDATE']);
});

test('student quiz payload preview: sanitized, geofence + access code gated, role-checked', async () => {
  const { jar: teacherJar, csrf: teacherCsrf, } = await login('phase24.teacher');
  const published = await mutating(teacherJar, teacherCsrf, 'POST', `/api/teacher/quizzes/${ids.quizzes.quizA}/publish`);
  assert.strictEqual(published.status, 200);
  const setGate = await mutating(teacherJar, teacherCsrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizA}`, { access_code: 'CODE-99', pass_mark: 75 });
  assert.strictEqual(setGate.status, 200);

  const { jar: studentJar } = await login('phase24.student');

  const noLocation = await call(studentJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?access_code=CODE-99`);
  assert.strictEqual(noLocation.status, 400);
  const outside = await call(studentJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?latitude=1&longitude=2&accuracy_meters=10&access_code=CODE-99`);
  assert.strictEqual(outside.status, 403);
  const noCode = await call(studentJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?latitude=${CLASS_LAT}&longitude=${CLASS_LNG}`);
  assert.strictEqual(noCode.status, 403);
  const wrongCode = await call(studentJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?latitude=${CLASS_LAT}&longitude=${CLASS_LNG}&access_code=WRONG`);
  assert.strictEqual(wrongCode.status, 403);

  const preview = await call(studentJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?latitude=${CLASS_LAT}&longitude=${CLASS_LNG}&access_code=CODE-99`);
  assert.strictEqual(preview.status, 200, preview.text);
  assert.strictEqual(preview.json.quiz.question_count, 3);
  assert.strictEqual(preview.json.questions.length, 3);
  const sanitized = preview.json.questions.every((q) => !('answer_data' in q) && !('correct_answer' in q));
  assert.ok(sanitized, 'no answer material leaks in preview');
  const mc = preview.json.questions.find((q) => q.question_type === 'MULTIPLE_CHOICE');
  assert.ok(mc && Array.isArray(mc.options) && mc.options.length === 3);
  assert.strictEqual(preview.json.quiz.access_code, undefined);
  assert.strictEqual(Number(preview.json.quiz.pass_mark), 75);

  const teacherPreview = await call(teacherJar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}`);
  assert.strictEqual(teacherPreview.status, 403);

  const student2 = await login('phase24.student2');
  const unenrolled = await call(student2.jar, 'GET', `/api/student/quizzes/${ids.quizzes.quizA}?latitude=${CLASS_LAT}&longitude=${CLASS_LNG}&access_code=CODE-99`);
  assert.strictEqual(unenrolled.status, 404);
});

test('grading fixes: case-insensitive TRUE/FALSE + percentage pass_mark', async () => {
  const { jar, csrf } = await login('phase24.student');

  const started = await mutating(jar, csrf, 'POST', `/api/student/quizzes/${ids.quizzes.quizA}/start`, {
    access_code: 'CODE-99',
    latitude: CLASS_LAT,
    longitude: CLASS_LNG,
    accuracy_meters: 10
  });
  assert.strictEqual(started.status, 200, started.text);
  const attemptId = started.json.attempt.id;

  const answers = started.json.questions.map((q) => {
    if (q.question_type === 'TRUE_FALSE') return { question_id: q.id, answer: 'true' };
    if (q.question_type === 'SHORT_ANSWER') return { question_id: q.id, answer: 'manila' };
    return { question_id: q.id, answer: '4' };
  });
  const submitted = await mutating(jar, csrf, 'POST', `/api/student/attempts/${attemptId}/submit`, { answers });
  assert.strictEqual(submitted.status, 200, submitted.text);
  assert.strictEqual(submitted.json.score, 3, `score ${submitted.text}`);
  assert.strictEqual(submitted.json.total, 3);
  assert.strictEqual(submitted.json.passed, true, `percentage pass_mark: ${submitted.text}`);

  const listAfter = await call(jar, 'GET', '/api/student/quizzes?page=1&limit=10');
  assert.ok(!(listAfter.json.quizzes || []).some((q) => q.id === ids.quizzes.quizA), 'attempted quiz leaves the available list');

  const teacher = await login('phase24.teacher');
  const confirmQuizLocked = await mutating(teacher.jar, teacher.csrf, 'PUT', `/api/teacher/quizzes/${ids.quizzes.quizA}`, { title: 'nope' });
  assert.strictEqual(confirmQuizLocked.status, 409);
  const confirmQuestionLocked = await mutating(teacher.jar, teacher.csrf, 'PUT', `/api/teacher/question-bank/${ids.questions.q1}`, { question_text: 'nope' });
  assert.strictEqual(confirmQuestionLocked.status, 409);
});

async function cleanup() {
  const quizIds = [ids.quizzes.quizA, ids.quizzes.quizB, ids.quizzes.quizC].filter(Boolean);
  if (quizIds.length) {
    const placeholders = quizIds.map(() => '?').join(',');
    await pool.query(`DELETE FROM quiz_attempt_answers WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE quiz_id IN (${placeholders}))`, quizIds);
    await pool.query(`DELETE FROM geofence_checks WHERE attempt_id IN (SELECT id FROM quiz_attempts WHERE quiz_id IN (${placeholders}))`, quizIds);
    await pool.query(`DELETE FROM quiz_attempts WHERE quiz_id IN (${placeholders})`, quizIds);
    await pool.query(`DELETE FROM quiz_questions WHERE quiz_id IN (${placeholders})`, quizIds);
    await pool.query(`DELETE FROM quiz_classes WHERE quiz_id IN (${placeholders})`, quizIds);
    await pool.query(`DELETE FROM quizzes WHERE id IN (${placeholders})`, quizIds);
  }
  const questionIds = Object.values(ids.questions).filter(Boolean);
  if (questionIds.length) await pool.query(`DELETE FROM question_bank WHERE id IN (${questionIds.map(() => '?').join(',')})`, questionIds);
  const userIds = Object.values(ids.users).filter(Boolean);
  if (userIds.length) {
    const placeholders = userIds.map(() => '?').join(',');
    await pool.query(`DELETE FROM student_classes WHERE student_id IN (${placeholders})`, userIds);
    await pool.query(`DELETE FROM teacher_classes WHERE teacher_id IN (${placeholders})`, userIds);
    await pool.query(`DELETE FROM teacher_courses WHERE teacher_id IN (${placeholders})`, userIds);
    await pool.query(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, userIds);
    await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
  }
}