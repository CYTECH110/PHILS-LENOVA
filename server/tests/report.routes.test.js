'use strict';

process.env.SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
process.env.SMTP_PORT = process.env.SMTP_PORT || '9';

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { startServer, stopServer, request, login } = require('./helpers');

const PASSWORD = 'Phase21Verify#2026';
const HASH = '$2b$12$rXruURSmFnyPPARndIIKee7IhrIUsuS1Uv3dGu8dqirPNm9TE4l2u';

const QUIZ_TITLE = 'P29 Report Quiz';
const REPORTS = ['attempts', 'quizzes', 'students'];
const FORMATS = { csv: 'text/csv', xlsx: 'spreadsheetml.sheet', pdf: 'application/pdf' };
const CONTENT_TYPES = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf'
};

const ids = { users: {}, courses: [], classes: [], quizzes: [], questions: [] };
const sessions = {};
let server = null;
let baseUrl = null;

test.before(async () => {
  ({ server, baseUrl } = await startServer());

  const usernames = ['p29.report.admin', 'p29.report.teacher', 'p29.report.other', 'p29.report.student'];
  await pool.execute('DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username IN (?, ?, ?, ?))', usernames);
  await pool.execute('DELETE FROM users WHERE username IN (?, ?, ?, ?)', usernames);

  for (const [key, username, fullName, role] of [
    ['admin', 'p29.report.admin', 'P29 Report Admin', 'ADMIN'],
    ['teacher', 'p29.report.teacher', 'P29 Report Teacher', 'TEACHER'],
    ['other', 'p29.report.other', 'P29 Report Other', 'TEACHER'],
    ['student', 'p29.report.student', 'P29 Report Student', 'STUDENT']
  ]) {
    const [result] = await pool.execute(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
      [username, HASH, fullName, role]
    );
    ids.users[key] = result.insertId;
    sessions[key] = await login(baseUrl, username, PASSWORD);
    assert.equal(sessions[key].status, 200, `login ${username} -> ${sessions[key].status}`);
  }

  const [course] = await pool.execute('INSERT INTO courses (name) VALUES (?)', ['P29 Report Course']);
  ids.courses.push(course.insertId);
  const [klass] = await pool.execute('INSERT INTO classes (name, code) VALUES (?, ?)', ['P29 Report Class', 'P29-REPORT-CLASS']);
  ids.classes.push(klass.insertId);

  await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)', [ids.users.teacher, course.insertId]);
  await pool.execute('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)', [ids.users.teacher, klass.insertId]);
  await pool.execute('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [ids.users.student, klass.insertId]);

  const [question] = await pool.execute(
    'INSERT INTO question_bank (teacher_id, question_type, question_text, answer_data, difficulty) VALUES (?, ?, ?, ?, ?)',
    [ids.users.teacher, 'TRUE_FALSE', 'The sky is blue.', '{"correct_answer":"TRUE"}', 'EASY']
  );
  ids.questions.push(question.insertId);

  const [quiz] = await pool.execute(
    "INSERT INTO quizzes (course_id, creator_id, title, status, duration_minutes, pass_mark) VALUES (?, ?, ?, 'PUBLISHED', 30, 50)",
    [course.insertId, ids.users.teacher, QUIZ_TITLE]
  );
  ids.quizzes.push(quiz.insertId);
  await pool.execute('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, ?)', [quiz.insertId, klass.insertId]);
  await pool.execute('INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES (?, ?, 1)', [quiz.insertId, ids.questions[0]]);
  await pool.execute(
    "INSERT INTO quiz_attempts (quiz_id, student_id, status, score, submitted_at, passed) VALUES (?, ?, 'SUBMITTED', 3, NOW(), 1)",
    [quiz.insertId, ids.users.student]
  );
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
  }
});

function download(pathName, session) {
  return request(baseUrl, 'GET', pathName, session ? { jar: session.jar } : {});
}

test('reports require an admin or teacher session', async () => {
  const anonymous = await download('/api/reports/attempts.csv');
  assert.equal(anonymous.status, 401);

  const asStudent = await download('/api/reports/attempts.csv', sessions.student);
  assert.equal(asStudent.status, 403);
  assert.equal((await asStudent.json()).error, 'Insufficient permissions');

  assert.equal((await download('/api/reports/attempts.csv', sessions.admin)).status, 200);
  const asTeacher = await download('/api/reports/attempts.csv', sessions.teacher);
  assert.equal(asTeacher.status, 200);
});

test('all report/format combinations stream a non-empty download for admins', async () => {
  for (const report of REPORTS) {
    for (const format of Object.keys(FORMATS)) {
      const response = await download(`/api/reports/${report}.${format}`, sessions.admin);
      assert.equal(response.status, 200, `${report}.${format}`);
      assert.equal(response.headers.get('content-type'), CONTENT_TYPES[format], `${report}.${format} content-type`);
      const disposition = response.headers.get('content-disposition') || '';
      assert.ok(disposition.startsWith('attachment;'), `${report}.${format} attachment`);
      assert.ok(disposition.includes(`.${format}`), `${report}.${format} filename extension`);
      const buffer = Buffer.from(await response.arrayBuffer());
      assert.ok(buffer.length > 0, `${report}.${format} body`);
    }
  }
});

test('attempts CSV carries a header row and the attempt data', async () => {
  const response = await download('/api/reports/attempts.csv', sessions.admin);
  const text = await response.text();
  assert.ok(text.startsWith('"Attempt","Student"'), 'csv header row present');
  assert.ok(text.includes(QUIZ_TITLE), 'csv includes the seeded attempt row');
});

test('teacher reports are scoped to their own quizzes', async () => {
  const own = await download('/api/reports/attempts.csv', sessions.teacher);
  const ownText = await own.text();
  assert.ok(ownText.includes(QUIZ_TITLE), 'own quiz appears in teacher export');

  const other = await download('/api/reports/attempts.csv', sessions.other);
  const otherText = await other.text();
  assert.ok(!otherText.includes(QUIZ_TITLE), 'foreign quiz is excluded from another teacher export');
});

test('unknown report name returns 404', async () => {
  const response = await download('/api/reports/unknown.csv', sessions.admin);
  assert.equal(response.status, 404);
});
