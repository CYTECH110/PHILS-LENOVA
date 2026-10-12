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

const TEACHER = { username: 'p29.teacher.main', name: 'P29 Teacher Main' };
const OTHER_TEACHER = { username: 'p29.teacher.other', name: 'P29 Teacher Other' };
const COURSE_NAME = 'P29 Teacher Course';
const CLASS_CODE = 'P29-TEACHER-CLASS';

const ids = { users: {}, courses: [], classes: [], quizzes: [], questions: [] };
let server = null;
let baseUrl = null;
let auth = null;

test.before(async () => {
  ({ server, baseUrl } = await startServer());

  const usernames = [TEACHER.username, OTHER_TEACHER.username];
  await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username IN (?, ?))`, usernames);
  await pool.execute('DELETE FROM users WHERE username IN (?, ?)', usernames);
  await pool.execute('DELETE FROM courses WHERE name = ?', [COURSE_NAME]);
  await pool.execute('DELETE FROM classes WHERE code = ?', [CLASS_CODE]);

  for (const [key, spec] of [['teacher', TEACHER], ['other', OTHER_TEACHER]]) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [spec.username, HASH, spec.name, 'TEACHER']
    );
    ids.users[key] = result.insertId;
  }

  const [course] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', [COURSE_NAME, 'p29']);
  ids.courses.push(course.insertId);
  const [klass] = await pool.execute('INSERT INTO classes (name, code) VALUES (?, ?)', ['P29 Teacher Class', CLASS_CODE]);
  ids.classes.push(klass.insertId);

  await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)', [ids.users.teacher, course.insertId]);
  await pool.execute('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)', [ids.users.teacher, klass.insertId]);

  auth = await login(baseUrl, TEACHER.username, PASSWORD);
  assert.equal(auth.status, 200, `login -> ${auth.status} ${auth.text}`);
});

test.after(async () => {
  try {
    const userIds = Object.values(ids.users);
    if (ids.quizzes.length) {
      const placeholders = ids.quizzes.map(() => '?').join(',');
      await pool.query(`DELETE FROM quiz_questions WHERE quiz_id IN (${placeholders})`, ids.quizzes);
      await pool.query(`DELETE FROM quizzes WHERE id IN (${placeholders})`, ids.quizzes);
    }
    if (ids.questions.length) {
      await pool.query(`DELETE FROM question_bank WHERE id IN (${ids.questions.map(() => '?').join(',')})`, ids.questions);
    }
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

test('teacher dashboard lists assigned courses and classes', async () => {
  const res = await call('GET', '/api/teacher/dashboard');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.courses.some((course) => course.id === ids.courses[0]));
  assert.ok(body.classes.some((klass) => klass.id === ids.classes[0]));
});

test('question bank create validation, listing, and quiz creation', async () => {
  const badType = await call('POST', '/api/teacher/question-bank', { question_type: 'NOPE', question_text: 'x', answer_data: { correct_answer: 'x' } });
  assert.equal(badType.status, 400);
  const badOptions = await call('POST', '/api/teacher/question-bank', { question_type: 'MULTIPLE_CHOICE', question_text: 'x', answer_data: { options: ['only'], correct_answer: 'only' } });
  assert.equal(badOptions.status, 400);
  const badTrueFalse = await call('POST', '/api/teacher/question-bank', { question_type: 'TRUE_FALSE', question_text: 'x', answer_data: { correct_answer: 'MAYBE' } });
  assert.equal(badTrueFalse.status, 400);

  const created = await call('POST', '/api/teacher/question-bank', {
    question_type: 'MULTIPLE_CHOICE',
    question_text: 'What is 2+2?',
    answer_data: { options: ['3', '4', '5'], correct_answer: '4' },
    difficulty: 'EASY'
  });
  assert.equal(created.status, 201, created.text);
  const createdBody = await created.json();
  ids.questions.push(createdBody.id);
  assert.equal(createdBody.image_path, null);

  const listRes = await request(baseUrl, 'GET', '/api/teacher/question-bank?limit=100', { jar: auth.jar });
  assert.ok((await listRes.json()).questions.some((question) => question.id === createdBody.id));

  const badQuiz = await call('POST', '/api/teacher/quizzes', { duration_minutes: 10, course_id: ids.courses[0] });
  assert.equal(badQuiz.status, 400, 'missing title');
  const foreignCourse = await call('POST', '/api/teacher/quizzes', { title: 'P29 Quiz Foreign', course_id: 999999, duration_minutes: 10 });
  assert.equal(foreignCourse.status, 403, 'course is not assigned');

  const quizRes = await call('POST', '/api/teacher/quizzes', { title: 'P29 Quiz One', course_id: ids.courses[0], duration_minutes: 10, class_ids: [ids.classes[0]] });
  assert.equal(quizRes.status, 201, quizRes.text);
  ids.quizzes.push((await quizRes.json()).id);
});

test('quiz detail, question attach, publish guards, and statistics', async () => {
  const quizId = ids.quizzes[0];

  const detail = await call('GET', `/api/teacher/quizzes/${quizId}`);
  assert.equal(detail.status, 200);
  const detailBody = await detail.json();
  assert.equal(detailBody.questions.length, 0);
  assert.deepEqual(detailBody.class_ids, [ids.classes[0]]);
  assert.equal((await call('GET', '/api/teacher/quizzes/999999')).status, 404);

  const attach = await call('POST', `/api/teacher/quizzes/${quizId}/questions`, { question_id: ids.questions[0] });
  assert.equal(attach.status, 201);
  assert.equal((await call('POST', `/api/teacher/quizzes/${quizId}/questions`, { question_id: ids.questions[0] })).status, 409);
  assert.equal((await call('POST', '/api/teacher/quizzes/999999/questions', { question_id: ids.questions[0] })).status, 404);

  const emptyRes = await call('POST', '/api/teacher/quizzes', { title: 'P29 Quiz Empty', course_id: ids.courses[0], duration_minutes: 10 });
  assert.equal(emptyRes.status, 201);
  const emptyId = (await emptyRes.json()).id;
  ids.quizzes.push(emptyId);
  assert.equal((await call('POST', `/api/teacher/quizzes/${emptyId}/publish`)).status, 409);

  const publish = await call('POST', `/api/teacher/quizzes/${quizId}/publish`);
  assert.equal(publish.status, 200);
  assert.equal((await publish.json()).status, 'PUBLISHED');

  const stats = await call('GET', `/api/teacher/quizzes/${quizId}/statistics`);
  assert.equal(stats.status, 200);
  const statsBody = await stats.json();
  assert.ok(Array.isArray(statsBody.results));
  assert.equal(statsBody.questions.length, 1);
  assert.equal((await call('GET', '/api/teacher/quizzes/999999/statistics')).status, 404);
});

test('quiz update validation, close, detach, and delete', async () => {
  const quizId = ids.quizzes[0];
  const emptyId = ids.quizzes[1];

  const updateRes = await call('PUT', `/api/teacher/quizzes/${quizId}`, { title: 'P29 Quiz One Renamed', duration_minutes: 15 });
  assert.equal(updateRes.status, 200);
  assert.equal((await updateRes.json()).quiz.title, 'P29 Quiz One Renamed');

  assert.equal((await call('PUT', `/api/teacher/quizzes/${quizId}`, {})).status, 400);
  assert.equal((await call('PUT', `/api/teacher/quizzes/${quizId}`, { duration_minutes: 0 })).status, 400);
  assert.equal((await call('PUT', '/api/teacher/quizzes/999999', { title: 'x' })).status, 404);

  assert.equal((await call('POST', `/api/teacher/quizzes/${quizId}/close`)).status, 200);

  const detach = await call('DELETE', `/api/teacher/quizzes/${quizId}/questions/${ids.questions[0]}`);
  assert.equal(detach.status, 200);
  assert.equal((await detach.json()).removed, true);
  assert.equal((await call('DELETE', `/api/teacher/quizzes/${quizId}/questions/${ids.questions[0]}`)).status, 404);

  const deleted = await call('DELETE', `/api/teacher/quizzes/${emptyId}`);
  assert.equal(deleted.status, 200);
  assert.equal((await deleted.json()).deleted, true);
  assert.equal((await call('DELETE', `/api/teacher/quizzes/${emptyId}`)).status, 404);
});

test('another teacher cannot read or mutate a foreign quiz', async () => {
  const other = await login(baseUrl, OTHER_TEACHER.username, PASSWORD);
  assert.equal(other.status, 200);
  const quizId = ids.quizzes[0];
  assert.equal((await call('GET', `/api/teacher/quizzes/${quizId}`, undefined, other)).status, 404);
  assert.equal((await call('PUT', `/api/teacher/quizzes/${quizId}`, { title: 'Takeover' }, other)).status, 404);
  assert.equal((await call('DELETE', `/api/teacher/quizzes/${quizId}`, undefined, other)).status, 404);
});
