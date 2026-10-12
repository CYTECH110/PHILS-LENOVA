const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const ROOT = path.resolve(__dirname, '../../..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const app = require('../../src/app');
const pool = require('../../src/config/database');

const out = [];
const check = (label, cond, detail) => out.push(`${cond ? 'PASS' : 'FAIL'} ${label}${detail ? ' :: ' + detail : ''}`);

const tag = crypto.randomBytes(3).toString('hex');
const PASSWORD = '__Phase24-verify-pw-123';
const USERNAMES = {
  admin: `__p24_admin_${tag}`,
  teacher: `__p24_teacher_${tag}`,
  teacher2: `__p24_teacher2_${tag}`,
  student: `__p24_student_${tag}`,
};

let server;
let base;
let csrfCookie;
let csrf;

const ids = {};

async function requestWith(pathname, { method = 'GET', cookie = '', csrfHeader = '', json, form } = {}) {
  const headers = {};
  if (cookie) headers.cookie = cookie;
  if (method !== 'GET' && method !== 'HEAD') headers['x-csrf-token'] = csrfHeader;
  let body;
  if (form) {
    body = form;
  } else if (json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const res = await fetch(base + pathname, { method, headers, body });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: res.status, body: data, setCookie: res.headers.get('set-cookie') || '' };
}

function login(username) {
  return requestWith('/api/auth/login', {
    method: 'POST',
    cookie: csrfCookie,
    csrfHeader: csrf,
    json: { username, password: PASSWORD },
  });
}

function authCookie(jwtCookie) {
  return `${jwtCookie}; ${csrfCookie}`;
}

async function insertUser(username, role) {
  const hash = await bcrypt.hash(PASSWORD, 12);
  const [result] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
    [username, hash, `P24 ${role} ${tag}`, role]
  );
  return result.insertId;
}

async function setupFixtures() {
  ids.admin = await insertUser(USERNAMES.admin, 'ADMIN');
  ids.teacher = await insertUser(USERNAMES.teacher, 'TEACHER');
  ids.teacher2 = await insertUser(USERNAMES.teacher2, 'TEACHER');
  ids.student = await insertUser(USERNAMES.student, 'STUDENT');

  const [course] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', [`__p24_course_${tag}__`, 'phase 24']);
  ids.course = course.insertId;

  const [cls] = await pool.execute('INSERT INTO classes (name, code, latitude, longitude, radius_meters) VALUES (?, ?, NULL, NULL, 100)', [`__p24_class_${tag}__`, `P24-${tag}`]);
  ids.class = cls.insertId;

  await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)', [ids.teacher, ids.course]);
  await pool.execute('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)', [ids.teacher, ids.class]);
  await pool.execute('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [ids.student, ids.class]);
}

async function cleanupFixtures() {
  try {
    const teacherIds = [ids.teacher, ids.teacher2].filter(Boolean);
    const inTeachers = teacherIds.length ? teacherIds.map(() => '?').join(',') : 'NULL';
    if (teacherIds.length) {
      await pool.execute(`DELETE FROM quiz_questions WHERE quiz_id IN (SELECT id FROM quizzes WHERE creator_id IN (${inTeachers}))`, teacherIds);
      await pool.execute(`DELETE FROM quizzes WHERE creator_id IN (${inTeachers})`, teacherIds);
      await pool.execute(`DELETE FROM question_bank WHERE teacher_id IN (${inTeachers})`, teacherIds);
    }
    if (ids.student) await pool.execute('DELETE FROM student_classes WHERE student_id = ?', [ids.student]);
    if (ids.class) {
      await pool.execute('DELETE FROM teacher_classes WHERE class_id = ?', [ids.class]);
      await pool.execute('DELETE FROM classes WHERE id = ?', [ids.class]);
    }
    if (ids.teacher) await pool.execute('DELETE FROM teacher_courses WHERE teacher_id = ?', [ids.teacher]);
    if (ids.course) await pool.execute('DELETE FROM courses WHERE id = ?', [ids.course]);
    await pool.execute("DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username LIKE '\\_\\_p24\\_%')");
    await pool.execute("DELETE FROM users WHERE username LIKE '\\_\\_p24\\_%'");
  } catch (error) {
    console.error('cleanup warning:', error.message);
  }
}

async function main() {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;

  const csrfRes = await fetch(base + '/api/csrf-token');
  csrfCookie = (csrfRes.headers.get('set-cookie') || '').split(';')[0];
  csrf = (await csrfRes.json()).csrfToken;

  await setupFixtures();

  const adminLogin = await login(USERNAMES.admin);
  const teacherLogin = await login(USERNAMES.teacher);
  const teacher2Login = await login(USERNAMES.teacher2);
  const studentLogin = await login(USERNAMES.student);
  check('admin login -> 200', adminLogin.status === 200, String(adminLogin.status));
  check('teacher login -> 200', teacherLogin.status === 200, String(teacherLogin.status));
  check('student login -> 200', studentLogin.status === 200, String(studentLogin.status));

  const adminCookie = authCookie((adminLogin.setCookie || '').split(';')[0]);
  const teacherCookie = authCookie((teacherLogin.setCookie || '').split(';')[0]);
  const teacher2Cookie = authCookie((teacher2Login.setCookie || '').split(';')[0]);
  const studentCookie = authCookie((studentLogin.setCookie || '').split(';')[0]);

  const teacher = (pathname, opts) => requestWith(pathname, { cookie: teacherCookie, csrfHeader: csrf, ...opts });
  const teacher2 = (pathname, opts) => requestWith(pathname, { cookie: teacher2Cookie, csrfHeader: csrf, ...opts });
  const student = (pathname, opts) => requestWith(pathname, { cookie: studentCookie, csrfHeader: csrf, ...opts });
  const admin = (pathname, opts) => requestWith(pathname, { cookie: adminCookie, csrfHeader: csrf, ...opts });

  /* ---------- question lifecycle ---------- */
  const makeQuestion = (question_type, question_text, answer_data, difficulty) =>
    teacher('/api/teacher/question-bank', { method: 'POST', json: { question_type, question_text, answer_data, difficulty } });

  let r = await makeQuestion('MULTIPLE_CHOICE', 'MC?', { options: ['A', 'B', 'C'], correct_answer: 'B' }, 'EASY');
  check('create MC question -> 201', r.status === 201 && r.body.id, `${r.status} ${JSON.stringify(r.body)}`);
  ids.qMC = r.body.id;

  r = await makeQuestion('TRUE_FALSE', 'TF?', { correct_answer: 'TRUE' }, 'MEDIUM');
  check('create TRUE_FALSE question -> 201', r.status === 201 && r.body.id, String(r.status));
  ids.qTF = r.body.id;

  r = await makeQuestion('SHORT_ANSWER', 'Capital?', { correct_answer: 'Manila' }, 'MEDIUM');
  check('create SHORT_ANSWER question -> 201', r.status === 201 && r.body.id, String(r.status));
  ids.qShort = r.body.id;

  r = await makeQuestion('FILL_BLANK', 'Planet?', { correct_answer: 'Mars' }, 'HARD');
  check('create FILL_BLANK question -> 201', r.status === 201 && r.body.id, String(r.status));
  ids.qFill = r.body.id;

  r = await makeQuestion('SHORT_ANSWER', 'edit me', { correct_answer: 'old' }, 'EASY');
  ids.qEdit = r.body.id;
  r = await makeQuestion('TRUE_FALSE', 'delete me', { correct_answer: 'FALSE' }, 'EASY');
  ids.qDel = r.body.id;
  r = await makeQuestion('MULTIPLE_CHOICE', 'image?', { options: ['Yes', 'No'], correct_answer: 'Yes' }, 'EASY');
  ids.qImage = r.body.id;

  // edit text + difficulty
  r = await teacher(`/api/teacher/question-bank/${ids.qEdit}`, {
    method: 'PUT',
    json: { question_text: 'edited text', difficulty: 'HARD', answer_data: { correct_answer: 'new' } },
  });
  check('update question -> 200', r.status === 200, `${r.status} ${JSON.stringify(r.body)}`);

  r = await teacher('/api/teacher/question-bank');
  const edited = (r.body.questions || []).find((q) => Number(q.id) === ids.qEdit);
  check('updated question persisted', edited && edited.question_text === 'edited text' && edited.difficulty === 'HARD', JSON.stringify(edited));

  // change type without answer_data -> 400
  r = await teacher(`/api/teacher/question-bank/${ids.qEdit}`, { method: 'PUT', json: { question_type: 'TRUE_FALSE' } });
  check('type change without answer_data -> 400', r.status === 400, String(r.status));

  // image set then clear
  const form = new globalThis.FormData();
  form.append('image', new globalThis.Blob([Buffer.from('89504e470d0a1a0a', 'hex')], { type: 'image/png' }), 'dot.png');
  r = await teacher(`/api/teacher/question-bank/${ids.qImage}`, { method: 'PUT', form });
  check('attach image -> 200 + /uploads/ path', r.status === 200 && /^\/uploads\//.test(r.body.image_path || ''), `${r.status} ${JSON.stringify(r.body)}`);
  const uploadedImage = r.body.image_path;

  r = await teacher(`/api/teacher/question-bank/${ids.qImage}`, { method: 'PUT', json: { image_path: '' } });
  check('clear image via image_path already supported', r.status === 200 && r.body.image_path === null, `${r.status} ${JSON.stringify(r.body)}`);
  check('cleared upload removed from disk', !require('fs').existsSync(path.join(ROOT, uploadedImage)));

  // ownership: foreign teacher gets 404
  r = await teacher2(`/api/teacher/question-bank/${ids.qEdit}`, { method: 'PUT', json: { question_text: 'hijack' } });
  check('foreign teacher update -> 404', r.status === 404, String(r.status));

  /* ---------- quiz lifecycle ---------- */
  const makeQuiz = (title, passMark, classIds) =>
    teacher('/api/teacher/quizzes', { method: 'POST', json: { title, course_id: ids.course, duration_minutes: 30, pass_mark: passMark, class_ids: classIds } });

  const attach = (quizId, questionId) => teacher(`/api/teacher/quizzes/${quizId}/questions`, { method: 'POST', json: { question_id: questionId } });

  r = await makeQuiz(`__p24_empty_${tag}`, 50, [ids.class]);
  check('create quiz -> 201', r.status === 201 && r.body.id, `${r.status} ${JSON.stringify(r.body)}`);
  ids.quizEmpty = r.body.id;

  r = await teacher(`/api/teacher/quizzes/${ids.quizEmpty}/publish`, { method: 'POST' });
  check('publish with no questions -> 409', r.status === 409 && /no questions/i.test(r.body.error || ''), `${r.status} ${JSON.stringify(r.body)}`);

  // attach / re-attach / detach
  r = await attach(ids.quizEmpty, ids.qDel);
  check('attach question -> 201', r.status === 201, String(r.status));
  r = await attach(ids.quizEmpty, ids.qDel);
  check('re-attach same question -> 409', r.status === 409, String(r.status));

  r = await teacher(`/api/teacher/question-bank/${ids.qDel}`, { method: 'DELETE' });
  check('delete attached question -> 409', r.status === 409, String(r.status));

  r = await teacher(`/api/teacher/quizzes/${ids.quizEmpty}/questions/${ids.qDel}`, { method: 'DELETE' });
  check('detach question -> 200', r.status === 200, String(r.status));

  r = await teacher(`/api/teacher/question-bank/${ids.qDel}`, { method: 'DELETE' });
  check('delete detached question -> 200', r.status === 200, String(r.status));

  // edit quiz metadata + class_ids
  r = await teacher(`/api/teacher/quizzes/${ids.quizEmpty}`, { method: 'PUT', json: { title: `__p24_renamed_${tag}`, pass_mark: 60 } });
  check('update quiz -> 200', r.status === 200 && r.body.quiz && r.body.quiz.title === `__p24_renamed_${tag}`, `${r.status} ${JSON.stringify(r.body)}`);
  r = await teacher(`/api/teacher/quizzes/${ids.quizEmpty}`);
  check('getQuizDetail returns class_ids', Array.isArray(r.body.class_ids) && r.body.class_ids.map(Number).includes(Number(ids.class)), JSON.stringify(r.body.class_ids));

  // delete draft quiz with no attempts
  r = await teacher('/api/teacher/quizzes', { method: 'POST', json: { title: `__p24_delete_${tag}`, course_id: ids.course, duration_minutes: 20, class_ids: [ids.class] } });
  const quizDelete = r.body.id;
  r = await teacher(`/api/teacher/quizzes/${quizDelete}`, { method: 'DELETE' });
  check('delete quiz with no attempts -> 200', r.status === 200, String(r.status));

  // foreign teacher cannot publish
  r = await teacher2(`/api/teacher/quizzes/${ids.quizEmpty}/publish`, { method: 'POST' });
  check('foreign teacher publish -> 404', r.status === 404, String(r.status));

  /* ---------- grading (percentage + normalization) ---------- */
  async function buildGradedQuiz(passMark) {
    const qr = await makeQuiz(`__p24_graded_${passMark}_${tag}`, passMark, [ids.class]);
    const quizId = qr.body.id;
    for (const qid of [ids.qMC, ids.qTF, ids.qShort, ids.qFill]) await attach(quizId, qid);
    const pr = await teacher(`/api/teacher/quizzes/${quizId}/publish`, { method: 'POST' });
    check(`publish graded quiz (pass_mark ${passMark}) -> 200`, pr.status === 200, String(pr.status));
    return quizId;
  }

  const quizPass = await buildGradedQuiz(50);
  const quizFail = await buildGradedQuiz(80);

  async function attempt(quizId, answers) {
    const start = await student(`/api/student/quizzes/${quizId}/start`, { method: 'POST', json: {} });
    check(`student start quiz ${quizId} -> 200`, start.status === 200 && start.body.attempt, `${start.status} ${JSON.stringify(start.body)}`);
    const submitted = await student(`/api/student/attempts/${start.body.attempt.id}/submit`, { method: 'POST', json: { answers } });
    return submitted;
  }

  // Quiz @ 50: exactly 2/4 correct (50%) -> passed. TF answered lowercase + padded.
  let sub = await attempt(quizPass, [
    { question_id: ids.qMC, answer: 'B' },
    { question_id: ids.qTF, answer: '   true ' },
    { question_id: ids.qShort, answer: 'Cebu' },
    { question_id: ids.qFill, answer: 'Venus' },
  ]);
  check('percentage boundary: 2/4 @ pass_mark 50 -> passed', sub.status === 200 && sub.body.score === 2 && sub.body.total === 4 && sub.body.passed === true, `${sub.status} ${JSON.stringify(sub.body)}`);
  check('TRUE_FALSE grading is case/whitespace-insensitive', sub.body.score >= 2, JSON.stringify(sub.body));

  // Quiz @ 80: 3/4 correct (75%) -> failed
  sub = await attempt(quizFail, [
    { question_id: ids.qMC, answer: 'B' },
    { question_id: ids.qTF, answer: 'TRUE' },
    { question_id: ids.qShort, answer: '  manila ' },
    { question_id: ids.qFill, answer: 'Venus' },
  ]);
  check('percentage boundary: 3/4 @ pass_mark 80 -> failed', sub.status === 200 && sub.body.score === 3 && sub.body.passed === false, `${sub.status} ${JSON.stringify(sub.body)}`);

  // answered questions become immutable
  r = await teacher(`/api/teacher/question-bank/${ids.qMC}`, { method: 'PUT', json: { question_text: 'after answers' } });
  check('edit question with submitted answers -> 409', r.status === 409, String(r.status));
  r = await teacher(`/api/teacher/question-bank/${ids.qMC}`, { method: 'DELETE' });
  check('delete question with submitted answers -> 409', r.status === 409, String(r.status));

  // quiz with attempts cannot be edited/deleted
  r = await teacher(`/api/teacher/quizzes/${quizPass}`, { method: 'PUT', json: { title: 'nope' } });
  check('edit quiz with submitted attempts -> 409', r.status === 409, String(r.status));
  r = await teacher(`/api/teacher/quizzes/${quizPass}`, { method: 'DELETE' });
  check('delete quiz with attempts -> 409', r.status === 409, String(r.status));

  /* ---------- class management ---------- */
  r = await admin(`/api/admin/classes/${ids.class}`);
  check('admin getClass -> 200', r.status === 200 && r.body.class && r.body.class.code === `P24-${tag}`, `${r.status} ${JSON.stringify(r.body)}`);

  r = await admin(`/api/admin/classes/${ids.class}`, { method: 'PUT', json: { name: `__p24_class_${tag}_x`, code: `P24-${tag}`, latitude: '14.5', longitude: '121.0', radius_meters: 150 } });
  check('admin updateClass -> 200', r.status === 200 && Number(r.body.radius_meters) === 150, `${r.status} ${JSON.stringify(r.body)}`);

  r = await admin(`/api/admin/classes/${ids.class}`, { method: 'PUT', json: { name: 'x', code: `P24-${tag}`, latitude: '14.5', longitude: '' } });
  check('updateClass with only latitude -> 400', r.status === 400, String(r.status));

  r = await admin('/api/admin/classes', { method: 'POST', json: { name: 'dup', code: `P24-${tag}` } });
  check('createClass duplicate code -> 409', r.status === 409, `${r.status} ${JSON.stringify(r.body)}`);

  /* ---------- allocations ---------- */
  r = await admin('/api/admin/allocations');
  const hasStudentClass = (r.body.studentClasses || []).some((row) => Number(row.student_id) === Number(ids.student) && Number(row.class_id) === Number(ids.class));
  const hasTeacherClass = (r.body.teacherClasses || []).some((row) => Number(row.teacher_id) === Number(ids.teacher) && Number(row.class_id) === Number(ids.class));
  const hasTeacherCourse = (r.body.teacherCourses || []).some((row) => Number(row.teacher_id) === Number(ids.teacher) && Number(row.course_id) === Number(ids.course));
  check('allocations list includes student->class', r.status === 200 && hasStudentClass, `${r.status} ${JSON.stringify(r.body)}`);
  check('allocations list includes teacher->class', hasTeacherClass);
  check('allocations list includes teacher->course', hasTeacherCourse);

  r = await admin(`/api/admin/allocations/students/${ids.student}/classes/${ids.class}`, { method: 'DELETE' });
  check('unassign student -> 204', r.status === 204, String(r.status));
  r = await admin(`/api/admin/allocations/students/${ids.student}/classes/${ids.class}`, { method: 'DELETE' });
  check('unassign missing allocation -> 404', r.status === 404, String(r.status));

  r = await admin(`/api/admin/allocations/teachers/${ids.teacher}/classes/${ids.class}`, { method: 'DELETE' });
  check('unassign teacher->class -> 204', r.status === 204, String(r.status));
  r = await admin(`/api/admin/allocations/courses/${ids.teacher}/courses/${ids.course}`, { method: 'DELETE' });
  check('unassign teacher->course -> 204', r.status === 204, String(r.status));

  r = await admin('/api/admin/allocations');
  const gone = (r.body.studentClasses || []).some((row) => Number(row.student_id) === Number(ids.student) && Number(row.class_id) === Number(ids.class));
  check('unassigned student->class no longer listed', gone === false);

  /* ---------- auth / role matrix ---------- */
  r = await requestWith('/api/admin/allocations');
  check('anon admin route -> 401', r.status === 401, String(r.status));
  r = await requestWith('/api/teacher/quizzes', { cookie: studentCookie });
  check('student on teacher route -> 403', r.status === 403, String(r.status));
  r = await requestWith('/api/admin/allocations', { cookie: teacherCookie });
  check('teacher on admin route -> 403', r.status === 403, String(r.status));
  r = await requestWith('/api/teacher/quizzes', { cookie: adminCookie });
  check('admin on teacher route -> 403', r.status === 403, String(r.status));

  r = await requestWith('/api/admin/classes', { method: 'POST', cookie: adminCookie, csrfHeader: 'wrong', json: { name: 'x', code: 'y' } });
  check('bad CSRF -> 403', r.status === 403, String(r.status));

  console.log(out.join('\n'));
  const failed = out.filter((line) => line.startsWith('FAIL'));
  console.log(`\n${out.length - failed.length}/${out.length} passed`);
  console.log(failed.length ? 'RESULT: FAILURES' : 'RESULT: ALL PASS');
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((error) => { console.error(error); console.log(out.join('\n')); process.exitCode = 1; })
  .finally(async () => {
    await cleanupFixtures();
    await pool.end();
    if (server) server.close();
    process.exit(out.some((line) => line.startsWith('FAIL')) ? 1 : 0);
  });
