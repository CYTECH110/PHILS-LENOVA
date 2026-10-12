'use strict';

process.env.SMTP_HOST = process.env.SMTP_HOST || '127.0.0.1';
process.env.SMTP_PORT = process.env.SMTP_PORT || '9';

const test = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../src/config/database');
const { startServer, stopServer, request, login } = require('./helpers');

const PASSWORD = 'Phase21Verify#2026';
const HASH = '$2b$12$rXruURSmFnyPPARndIIKee7IhrIUsuS1Uv3dGu8dqirPNm9TE4l2u';
const ADMIN_USERNAME = 'p29.admin.root';

const ids = { users: [], classes: [], courses: [] };
let server = null;
let baseUrl = null;
let admin = null;

test.before(async () => {
  ({ server, baseUrl } = await startServer());

  await pool.execute(`DELETE FROM audit_logs WHERE user_id IN (SELECT id FROM users WHERE username = ?)`, [ADMIN_USERNAME]);
  await pool.execute('DELETE FROM users WHERE username = ?', [ADMIN_USERNAME]);
  const [result] = await pool.execute(
    'INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)',
    [ADMIN_USERNAME, HASH, 'P29 Admin Root', 'ADMIN']
  );
  ids.users.push(result.insertId);

  const session = await login(baseUrl, ADMIN_USERNAME, PASSWORD);
  assert.equal(session.status, 200, `admin login -> ${session.status} ${session.text}`);
  admin = { jar: session.jar, csrf: session.csrf };
});

test.after(async () => {
  try {
    if (ids.users.length) {
      const placeholders = ids.users.map(() => '?').join(',');
      await pool.query(`DELETE FROM student_classes WHERE student_id IN (${placeholders})`, ids.users);
      await pool.query(`DELETE FROM teacher_classes WHERE teacher_id IN (${placeholders})`, ids.users);
      await pool.query(`DELETE FROM teacher_courses WHERE teacher_id IN (${placeholders})`, ids.users);
      await pool.query(`DELETE FROM audit_logs WHERE user_id IN (${placeholders})`, ids.users);
      await pool.query(`DELETE FROM users WHERE id IN (${placeholders})`, ids.users);
    }
    if (ids.classes.length) await pool.query(`DELETE FROM classes WHERE id IN (${ids.classes.map(() => '?').join(',')})`, ids.classes);
    if (ids.courses.length) await pool.query(`DELETE FROM courses WHERE id IN (${ids.courses.map(() => '?').join(',')})`, ids.courses);
  } finally {
    await stopServer(server);
    await pool.end();
  }
});

const api = (method, pathName, body) =>
  request(baseUrl, method, pathName, { jar: admin.jar, csrf: admin.csrf, body });

test('admin dashboard returns numeric counts', async () => {
  const response = await request(baseUrl, 'GET', '/api/admin/dashboard', { jar: admin.jar });
  assert.equal(response.status, 200);
  const body = await response.json();
  for (const key of ['users', 'students', 'teachers', 'courses', 'classes']) {
    assert.ok(Number.isInteger(Number(body[key])), `${key} should be numeric`);
  }
});

test('courses CRUD and validation', async () => {
  const createRes = await api('POST', '/api/admin/courses', { name: 'P29 Course Alpha', description: 'alpha' });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  ids.courses.push(created.id);

  const listRes = await request(baseUrl, 'GET', '/api/admin/courses?limit=100', { jar: admin.jar });
  const list = await listRes.json();
  assert.ok(list.courses.some((course) => course.id === created.id));

  const updateRes = await api('PUT', `/api/admin/courses/${created.id}`, { name: 'P29 Course Alpha Renamed', status: 'INACTIVE' });
  assert.equal(updateRes.status, 200);
  assert.equal((await updateRes.json()).status, 'INACTIVE');

  assert.equal((await api('POST', '/api/admin/courses', {})).status, 400);
  assert.equal((await api('PUT', '/api/admin/courses/999999', { name: 'nope' })).status, 404);
  assert.equal((await api('DELETE', '/api/admin/courses/999999')).status, 404);
  assert.equal((await api('DELETE', `/api/admin/courses/${created.id}`)).status, 204);
});

test('classes CRUD, geofence validation, and duplicate code guard', async () => {
  const createRes = await api('POST', '/api/admin/classes', { name: 'P29 Class Alpha', code: 'P29-CLASS-ALPHA', latitude: 5.6037, longitude: -0.187, radius_meters: 100 });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  ids.classes.push(created.id);

  const getRes = await request(baseUrl, 'GET', `/api/admin/classes/${created.id}`, { jar: admin.jar });
  assert.equal(getRes.status, 200);
  assert.equal((await getRes.json()).class.code, 'P29-CLASS-ALPHA');

  const duplicate = await api('POST', '/api/admin/classes', { name: 'P29 Class Beta', code: 'P29-CLASS-ALPHA' });
  assert.equal(duplicate.status, 409);

  const updateRes = await api('PUT', `/api/admin/classes/${created.id}`, { name: 'P29 Class Alpha2', code: 'P29-CLASS-ALPHA', latitude: 5.6, longitude: -0.18, radius_meters: 150 });
  assert.equal(updateRes.status, 200);
  assert.equal(Number((await updateRes.json()).radius_meters), 100 + 50);

  const badLatitude = await api('PUT', `/api/admin/classes/${created.id}`, { name: 'P29 Class Alpha', code: 'P29-CLASS-ALPHA', latitude: 200, longitude: 0 });
  assert.equal(badLatitude.status, 400);

  assert.equal((await api('POST', '/api/admin/classes', { name: 'No code' })).status, 400);
  assert.equal((await request(baseUrl, 'GET', '/api/admin/classes/999999', { jar: admin.jar })).status, 404);
});

test('users CRUD and validation', async () => {
  const createRes = await api('POST', '/api/admin/users', { username: 'p29.admin.teacher', full_name: 'P29 Teacher', password: 'P29Password123', role: 'TEACHER', email: 'p29.teacher@example.com' });
  assert.equal(createRes.status, 201);
  const created = await createRes.json();
  ids.users.push(created.id);

  assert.equal((await api('POST', '/api/admin/users', { username: 'p29.admin.teacher', full_name: 'Dup', password: 'P29Password123', role: 'TEACHER' })).status, 409);
  assert.equal((await api('POST', '/api/admin/users', { username: 'p29.admin.badrole', full_name: 'Bad', password: 'P29Password123', role: 'ADMIN' })).status, 400);
  assert.equal((await api('POST', '/api/admin/users', { username: 'p29.admin.nopass', full_name: 'No Pass', role: 'STUDENT' })).status, 400);
  assert.equal((await api('POST', '/api/admin/users', { username: 'p29.admin.bademail', full_name: 'Bad Email', password: 'P29Password123', role: 'STUDENT', email: 'not-an-email' })).status, 400);

  const listRes = await request(baseUrl, 'GET', '/api/admin/users?limit=100', { jar: admin.jar });
  assert.ok((await listRes.json()).users.some((user) => user.id === created.id));

  const updateRes = await api('PUT', `/api/admin/users/${created.id}`, { full_name: 'P29 Teacher Edited', role: 'STUDENT', status: 'INACTIVE' });
  assert.equal(updateRes.status, 200);
  assert.equal((await updateRes.json()).role, 'STUDENT');

  assert.equal((await api('PUT', '/api/admin/users/999999', { full_name: 'x', role: 'STUDENT' })).status, 404);
  assert.equal((await api('PUT', `/api/admin/users/${created.id}`, { full_name: 'x', role: 'ADMIN' })).status, 400);

  assert.equal((await api('DELETE', '/api/admin/users/999999')).status, 404);
  const deleteTarget = await api('POST', '/api/admin/users', { username: 'p29.admin.delete', full_name: 'P29 Delete Target', password: 'P29Password123', role: 'STUDENT' });
  assert.equal(deleteTarget.status, 201);
  const deleteId = (await deleteTarget.json()).id;
  ids.users.push(deleteId);
  assert.equal((await api('DELETE', `/api/admin/users/${deleteId}`)).status, 204);
  assert.equal((await api('DELETE', `/api/admin/users/${deleteId}`)).status, 204);

  const afterDelete = await request(baseUrl, 'GET', '/api/admin/users?limit=100', { jar: admin.jar });
  const deactivated = (await afterDelete.json()).users.find((user) => user.id === deleteId);
  assert.equal(deactivated.status, 'INACTIVE');
});

test('allocations assign, list, and unassign', async () => {
  const classRes = await api('POST', '/api/admin/classes', { name: 'P29 Alloc Class', code: 'P29-ALLOC-CLASS' });
  const classId = (await classRes.json()).id;
  ids.classes.push(classId);
  const courseRes = await api('POST', '/api/admin/courses', { name: 'P29 Alloc Course' });
  const courseId = (await courseRes.json()).id;
  ids.courses.push(courseId);
  const teacherRes = await api('POST', '/api/admin/users', { username: 'p29.admin.alloc.teacher', full_name: 'P29 Alloc Teacher', password: 'P29Password123', role: 'TEACHER' });
  const teacherId = (await teacherRes.json()).id;
  ids.users.push(teacherId);
  const studentRes = await api('POST', '/api/admin/users', { username: 'p29.admin.alloc.student', full_name: 'P29 Alloc Student', password: 'P29Password123', role: 'STUDENT' });
  const studentId = (await studentRes.json()).id;
  ids.users.push(studentId);

  assert.equal((await api('POST', '/api/admin/allocations/students', { student_id: studentId, class_id: classId })).status, 201);
  assert.equal((await api('POST', '/api/admin/allocations/teachers', { teacher_id: teacherId, class_id: classId })).status, 201);
  assert.equal((await api('POST', '/api/admin/allocations/courses', { teacher_id: teacherId, course_id: courseId })).status, 201);

  const allocRes = await request(baseUrl, 'GET', '/api/admin/allocations', { jar: admin.jar });
  const allocations = await allocRes.json();
  assert.ok(allocations.studentClasses.some((row) => row.student_id === studentId && row.class_id === classId));
  assert.ok(allocations.teacherClasses.some((row) => row.teacher_id === teacherId && row.class_id === classId));
  assert.ok(allocations.teacherCourses.some((row) => row.teacher_id === teacherId && row.course_id === courseId));

  // Deleting a user with allocations must not fail on the audit_logs/allocation
  // foreign keys - it deactivates instead (regression for the FK 500 defect).
  assert.equal((await api('DELETE', `/api/admin/users/${studentId}`)).status, 204);
  assert.equal((await api('DELETE', `/api/admin/users/${teacherId}`)).status, 204);

  assert.equal((await api('POST', '/api/admin/allocations/students', { student_id: studentId })).status, 400);

  assert.equal((await api('DELETE', `/api/admin/allocations/students/${studentId}/classes/${classId}`)).status, 204);
  assert.equal((await api('DELETE', `/api/admin/allocations/students/${studentId}/classes/${classId}`)).status, 404);
  assert.equal((await api('DELETE', `/api/admin/allocations/teachers/${teacherId}/classes/${classId}`)).status, 204);
  assert.equal((await api('DELETE', `/api/admin/allocations/courses/${teacherId}/courses/${courseId}`)).status, 204);
});

test('audit-logs endpoint returns recorded admin actions', async () => {
  const res = await request(baseUrl, 'GET', '/api/admin/audit-logs?limit=50', { jar: admin.jar });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.logs));
  assert.ok(body.logs.some((row) => row.action === 'COURSE_CREATE'));
});
