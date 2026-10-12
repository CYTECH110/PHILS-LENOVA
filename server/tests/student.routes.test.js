'use strict';

process.env.SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
process.env.SMTP_PORT = process.env.SMTP_PORT || '9';

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { redisClient } = require('../src/config/redis');
const { startServer, stopServer, request, login } = require('./helpers');

const PASSWORD = 'Phase21Verify#2026';
const HASH = '$2b$12$rXruURSmFnyPPARndIIKee7IhrIUsuS1Uv3dGu8dqirPNm9TE4l2u';
const CLASS_LAT = 5.6037;
const CLASS_LNG = -0.187;

const STUDENT = { username: 'p29.student.main', name: 'P29 Student Main' };
const OTHER_STUDENT = { username: 'p29.student.other', name: 'P29 Student Other' };
const TEACHER = { username: 'p29.student.teacher', name: 'P29 Student Teacher' };

const ids = { users: {}, courses: [], classes: [], quizzes: [], questions: [] };
let server = null;
let baseUrl = null;
let auth = null;

test.before(async () => {
  ({ server, baseUrl } = await startServer());

  const usernames = [STUDENT.username, OTHER_STUDENT.username, TEACHER.username];
  await pool.execute('DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username IN (?, ?, ?))', usernames);
  await pool.execute('DELETE FROM users WHERE username IN (?, ?, ?)', usernames);

  for (const [key, spec, role] of [['student', STUDENT, 'STUDENT'], ['other', OTHER_STUDENT, 'STUDENT'], ['teacher', TEACHER, 'TEACHER']]) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [spec.username, HASH, spec.name, role]
    );
    ids.users[key] = result.insertId;
  }

  const [course] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', ['P29 Student Course', 'p29']);
  ids.courses.push(course.insertId);
  const [klass] = await pool.execute(
    'INSERT INTO classes (name, code, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)',
    ['P29 Student Class', 'P29-STUDENT-CLASS', CLASS_LAT, CLASS_LNG, 100]
  );
  ids.classes.push(klass.insertId);

  await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)', [ids.users.teacher, course.insertId]);
  await pool.execute('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)', [ids.users.teacher, klass.insertId]);
  await pool.execute('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [ids.users.student, klass.insertId]);

  const questionSpecs = [
    ['MULTIPLE_CHOICE', 'What is 2+2?', '{"options":["3","4","5"],"correct_answer":"4"}'],
    ['TRUE_FALSE', 'The sky is blue.', '{"correct_answer":"TRUE"}'],
    ['SHORT_ANSWER', 'Capital of the Philippines?', '{"correct_answer":"Manila"}']
  ];
  for (const [type, text, data] of questionSpecs) {
    const [result] = await pool.execute(
      'INSERT INTO question_bank (teacher_id, question_type, question_text, answer_data, difficulty) VALUES (?, ?, ?, ?, ?)',
      [ids.users.teacher, type, text, data, 'EASY']
    );
    ids.questions.push(result.insertId);
  }

  const [published] = await pool.execute(
    "INSERT INTO quizzes (course_id, creator_id, title, status, duration_minutes, access_code, pass_mark) VALUES (?, ?, ?, 'PUBLISHED', 30, 'P29CODE', 50)",
    [course.insertId, ids.users.teacher, 'P29 Student Quiz']
  );
  ids.quizzes.push(published.insertId);
  await pool.execute('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, ?)', [published.insertId, klass.insertId]);
  let position = 1;
  for (const questionId of ids.questions) {
    await pool.execute('INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES (?, ?, ?)', [published.insertId, questionId, position]);
    position += 1;
  }

  const [draft] = await pool.execute(
    "INSERT INTO quizzes (course_id, creator_id, title, status, duration_minutes, pass_mark) VALUES (?, ?, ?, 'DRAFT', 30, 50)",
    [course.insertId, ids.users.teacher, 'P29 Student Draft']
  );
  ids.quizzes.push(draft.insertId);
  await pool.execute('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, ?)', [draft.insertId, klass.insertId]);

  auth = await login(baseUrl, STUDENT.username, PASSWORD);
  assert.equal(auth.status, 200, `login -> ${auth.status} ${auth.text}`);
});

test.after(async () => {
  try {
    if (ids.quizzes.length) {
      const placeholders = ids.quizzes.map(() => '?').join(',');
      await pool.query(`DELETE FROM quiz_questions WHERE quiz_id IN (${placeholders})`, ids.quizzes);
      await pool.query(`DELETE FROM quizzes WHERE id IN (${placeholders})`, ids.quizzes);
    }
    if (ids.questions.length) {
      await pool.query(`DELETE FROM question_bank WHERE id IN (${ids.questions.map(() => '?').join(',')})`, ids.questions);
    }
    const userIds = Object.values(ids.users);
    if (userIds.length) {
      const placeholders = userIds.map(() => '?').join(',');
      await pool.query(`DELETE FROM student_classes WHERE student_id IN (${placeholders})`, userIds);
      await pool.query(`DELETE FROM teacher_classes WHERE teacher_id IN (${placeholders})`, userIds);
      await pool.query(`DELETE FROM teacher_courses WHERE teacher_id IN (${placeholders})`, userIds);
      await pool.query(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, userIds);
      await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, userIds);
    }
    if (ids.classes.length) await pool.query(`DELETE FROM classes WHERE id IN (${ids.classes.map(() => '?').join(',')})`, ids.classes);
    if (ids.courses.length) await pool.query(`DELETE FROM courses WHERE id IN (${ids.courses.map(() => '?').join(',')})`, ids.courses);
  } finally {
    await stopServer(server);
    await pool.end();
    try { await redisClient.quit(); } catch { /* already closed */ }
  }
});

function call(method, pathName, body, session = auth) {
  return request(baseUrl, method, pathName, { jar: session.jar, csrf: session.csrf, body });
}

test('student dashboard and available quizzes', async () => {
  const dashboard = await call('GET', '/api/student/dashboard');
  assert.equal(dashboard.status, 200);
  const dashboardBody = await dashboard.json();
  assert.ok(Array.isArray(dashboardBody.courses));
  assert.ok(Array.isArray(dashboardBody.history));

  const list = await call('GET', '/api/student/quizzes?limit=100');
  assert.equal(list.status, 200);
  const quizIds = (await list.json()).quizzes.map((quiz) => quiz.id);
  assert.ok(quizIds.includes(ids.quizzes[0]), 'published quiz is available');
  assert.ok(!quizIds.includes(ids.quizzes[1]), 'draft quiz is hidden');
});

test('quiz preview enforces access code, geofence, and enrolment', async () => {
  const quizId = ids.quizzes[0];
  const inside = `latitude=${CLASS_LAT}&longitude=${CLASS_LNG}`;
  const outside = 'latitude=1&longitude=2';

  assert.equal((await call('GET', `/api/student/quizzes/${quizId}?${inside}`)).status, 403, 'missing access code');
  assert.equal((await call('GET', `/api/student/quizzes/${quizId}?access_code=P29CODE`)).status, 400, 'missing location');
  assert.equal((await call('GET', `/api/student/quizzes/${quizId}?${outside}&access_code=P29CODE`)).status, 403, 'outside classroom');

  const preview = await call('GET', `/api/student/quizzes/${quizId}?${inside}&access_code=P29CODE`);
  assert.equal(preview.status, 200, preview.text);
  const body = await preview.json();
  assert.equal(body.quiz.question_count, 3);
  assert.ok(body.questions.every((question) => !('answer_data' in question) && !('correct_answer' in question)));

  const other = await login(baseUrl, OTHER_STUDENT.username, PASSWORD);
  assert.equal((await call('GET', `/api/student/quizzes/${quizId}?${inside}&access_code=P29CODE`, undefined, other)).status, 404);

  assert.equal((await call('GET', `/api/student/quizzes/${ids.quizzes[1]}?${inside}&access_code=P29CODE`)).status, 404, 'draft is unavailable');
});

test('start quiz enforces code and location, then tracks and grades the attempt', async () => {
  const quizId = ids.quizzes[0];
  const inside = { access_code: 'P29CODE', latitude: CLASS_LAT, longitude: CLASS_LNG, accuracy_meters: 10 };
  const outside = { access_code: 'P29CODE', latitude: 1, longitude: 2, accuracy_meters: 10 };

  assert.equal((await call('POST', `/api/student/quizzes/${quizId}/start`, { latitude: CLASS_LAT, longitude: CLASS_LNG })).status, 403, 'missing access code');
  assert.equal((await call('POST', `/api/student/quizzes/${quizId}/start`, { access_code: 'P29CODE' })).status, 400, 'missing location');
  assert.equal((await call('POST', `/api/student/quizzes/${quizId}/start`, outside)).status, 403, 'outside classroom');

  const started = await call('POST', `/api/student/quizzes/${quizId}/start`, inside);
  assert.equal(started.status, 200, started.text);
  const startedBody = await started.json();
  const attemptId = startedBody.attempt.id;
  assert.ok(attemptId);
  assert.ok(startedBody.questions.every((question) => !('answer_data' in question)));

  const resumed = await call('POST', `/api/student/quizzes/${quizId}/start`, inside);
  assert.equal(resumed.status, 200);
  assert.equal((await resumed.json()).attempt.id, attemptId, 'resumes the open attempt');

  const insideCheck = await call('POST', `/api/student/attempts/${attemptId}/location`, { latitude: CLASS_LAT, longitude: CLASS_LNG, accuracy_meters: 10 });
  assert.equal(insideCheck.status, 200);
  assert.equal((await insideCheck.json()).allowed, true);
  const outsideCheck = await call('POST', `/api/student/attempts/${attemptId}/location`, { latitude: 1, longitude: 2, accuracy_meters: 10 });
  assert.equal(outsideCheck.status, 403);

  const answers = startedBody.questions.map((question) => {
    if (question.question_type === 'TRUE_FALSE') return { question_id: question.id, answer: 'true' };
    if (question.question_type === 'SHORT_ANSWER') return { question_id: question.id, answer: 'manila' };
    return { question_id: question.id, answer: '4' };
  });
  const submitted = await call('POST', `/api/student/attempts/${attemptId}/submit`, { answers });
  assert.equal(submitted.status, 200, submitted.text);
  const submittedBody = await submitted.json();
  assert.equal(submittedBody.score, 3);
  assert.equal(submittedBody.total, 3);
  assert.equal(submittedBody.passed, true);

  const history = await call('GET', '/api/student/history?limit=100');
  assert.equal(history.status, 200);
  assert.ok((await history.json()).history.some((attempt) => attempt.id === attemptId));

  const listAfter = await call('GET', '/api/student/quizzes?limit=100');
  assert.ok(!(await listAfter.json()).quizzes.some((quiz) => quiz.id === quizId), 'attempted quiz leaves the list');
});

test('unenrolled student cannot start a quiz', async () => {
  const other = await login(baseUrl, OTHER_STUDENT.username, PASSWORD);
  const quizId = ids.quizzes[0];
  const res = await call('POST', `/api/student/quizzes/${quizId}/start`, { access_code: 'P29CODE', latitude: CLASS_LAT, longitude: CLASS_LNG }, other);
  assert.equal(res.status, 404);
});
