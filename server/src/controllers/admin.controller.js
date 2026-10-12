const pool = require('../config/database');
const { hashPassword } = require('../services/password.service');
const { recordAudit } = require('../services/audit.service');
const { requireString, requirePositiveInteger, requireOptionalEmail } = require('../validators/common');

async function dashboard(request, response, next) {
  try {
    const [[users]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [[students]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'STUDENT'");
    const [[teachers]] = await pool.query("SELECT COUNT(*) AS total FROM users WHERE role = 'TEACHER'");
    const [[courses]] = await pool.query("SELECT COUNT(*) AS total FROM courses WHERE status = 'ACTIVE'");
    const [[classes]] = await pool.query('SELECT COUNT(*) AS total FROM classes');
    response.json({ users: users.total, students: students.total, teachers: teachers.total, courses: courses.total, classes: classes.total });
  } catch (error) { next(error); }
}

async function listCourses(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.query('SELECT * FROM courses ORDER BY name LIMIT ? OFFSET ?', [limit, offset]);
    response.json({ courses: rows });
  } catch (error) { next(error); }
}

async function createCourse(request, response, next) {
  try {
    const name = requireString(request.body.name, 'name', { max: 160 });
    const description = typeof request.body.description === 'string' ? request.body.description.trim() : null;
    const [result] = await pool.execute('INSERT INTO courses (name, description) VALUES (?, ?)', [name, description]);
    await recordAudit(request.user.sub, 'COURSE_CREATE', { courseId: result.insertId });
    response.status(201).json({ id: result.insertId, name, description });
  } catch (error) { next(error); }
}

async function updateCourse(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'course id');
    const name = requireString(request.body.name, 'name', { max: 160 });
    const description = typeof request.body.description === 'string' ? request.body.description.trim() : null;
    const status = request.body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const [result] = await pool.execute('UPDATE courses SET name = ?, description = ?, status = ? WHERE id = ?', [name, description, status, id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Course not found' });
    await recordAudit(request.user.sub, 'COURSE_UPDATE', { courseId: id });
    response.json({ id, name, description, status });
  } catch (error) { next(error); }
}

async function deleteCourse(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'course id');
    const [result] = await pool.execute("UPDATE courses SET status = 'INACTIVE' WHERE id = ?", [id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Course not found' });
    await recordAudit(request.user.sub, 'COURSE_DEACTIVATE', { courseId: id });
    response.status(204).send();
  } catch (error) { next(error); }
}

async function listClasses(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.query('SELECT * FROM classes ORDER BY name LIMIT ? OFFSET ?', [limit, offset]);
    response.json({ classes: rows });
  } catch (error) { next(error); }
}

async function createClass(request, response, next) {
  try {
    const name = requireString(request.body.name, 'name', { max: 120 });
    const code = requireString(request.body.code, 'code', { max: 40 });
    const latitude = request.body.latitude ?? null;
    const longitude = request.body.longitude ?? null;
    const radius = request.body.radius_meters || 100;
    const [result] = await pool.execute('INSERT INTO classes (name, code, latitude, longitude, radius_meters) VALUES (?, ?, ?, ?, ?)', [name, code, latitude, longitude, radius]);
    await recordAudit(request.user.sub, 'CLASS_CREATE', { classId: result.insertId });
    response.status(201).json({ id: result.insertId, name, code });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'Class code is already in use' });
    next(error);
  }
}

function parseCoordinate(value, field, min, max) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${field} must be a number between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

async function getClass(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'class id');
    const [rows] = await pool.execute('SELECT * FROM classes WHERE id = ?', [id]);
    if (!rows.length) return response.status(404).json({ error: 'Class not found' });
    response.json({ class: rows[0] });
  } catch (error) { next(error); }
}

async function updateClass(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'class id');
    const [existing] = await pool.execute('SELECT id FROM classes WHERE id = ?', [id]);
    if (!existing.length) return response.status(404).json({ error: 'Class not found' });
    const name = requireString(request.body.name, 'name', { max: 120 });
    const code = requireString(request.body.code, 'code', { max: 40 });
    const latitude = parseCoordinate(request.body.latitude, 'latitude', -90, 90);
    const longitude = parseCoordinate(request.body.longitude, 'longitude', -180, 180);
    if ((latitude === null) !== (longitude === null)) {
      return response.status(400).json({ error: 'Provide both latitude and longitude, or neither' });
    }
    const radius = request.body.radius_meters === undefined || request.body.radius_meters === null || request.body.radius_meters === ''
      ? 100
      : requirePositiveInteger(request.body.radius_meters, 'radius_meters');
    await pool.execute('UPDATE classes SET name = ?, code = ?, latitude = ?, longitude = ?, radius_meters = ? WHERE id = ?', [name, code, latitude, longitude, radius, id]);
    await recordAudit(request.user.sub, 'CLASS_UPDATE', { classId: id });
    response.json({ id, name, code, latitude, longitude, radius_meters: radius });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'Class code is already in use' });
    next(error);
  }
}

async function createUser(request, response, next) {
  try {
    const username = requireString(request.body.username, 'username', { max: 80 });
    const fullName = requireString(request.body.full_name, 'full_name', { max: 160 });
    const password = requireString(request.body.password, 'password', { min: 12, max: 200 });
    const email = requireOptionalEmail(request.body.email, 'email');
    const role = ['TEACHER', 'STUDENT'].includes(request.body.role) ? request.body.role : null;
    if (!role) return response.status(400).json({ error: 'role must be TEACHER or STUDENT' });
    const passwordHash = await hashPassword(password);
    let result;
    try {
      [result] = await pool.execute('INSERT INTO users (username, password_hash, full_name, role, email) VALUES (?, ?, ?, ?, ?)', [username, passwordHash, fullName, role, email]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') return response.status(409).json({ error: 'Username or email is already in use' });
      throw error;
    }
    await recordAudit(request.user.sub, 'USER_CREATE', { userId: result.insertId, role });

    // Best-effort: the service logs and swallows failures and skips users without an email.
    const { sendWelcomeEmail } = require('../services/email.service');
    await sendWelcomeEmail({ username, full_name: fullName, role, email });

    response.status(201).json({ id: result.insertId, username, full_name: fullName, role, email });
  } catch (error) { next(error); }
}

async function assignStudent(request, response, next) {
  try {
    const studentId = requirePositiveInteger(request.body.student_id, 'student_id');
    const classId = requirePositiveInteger(request.body.class_id, 'class_id');
    await pool.execute('INSERT INTO student_classes (student_id, class_id) VALUES (?, ?)', [studentId, classId]);
    await recordAudit(request.user.sub, 'STUDENT_CLASS_ASSIGN', { studentId, classId });
    response.status(201).json({ studentId, classId });
  } catch (error) { next(error); }
}

async function assignTeacher(request, response, next) {
  try {
    const teacherId = requirePositiveInteger(request.body.teacher_id, 'teacher_id');
    const classId = requirePositiveInteger(request.body.class_id, 'class_id');
    await pool.execute('INSERT INTO teacher_classes (teacher_id, class_id) VALUES (?, ?)', [teacherId, classId]);
    await recordAudit(request.user.sub, 'TEACHER_CLASS_ASSIGN', { teacherId, classId });
    response.status(201).json({ teacherId, classId });
  } catch (error) { next(error); }
}

async function assignCourse(request, response, next) {
  try {
    const teacherId = requirePositiveInteger(request.body.teacher_id, 'teacher_id');
    const courseId = requirePositiveInteger(request.body.course_id, 'course_id');
    await pool.execute('INSERT INTO teacher_courses (teacher_id, course_id) VALUES (?, ?)', [teacherId, courseId]);
    await recordAudit(request.user.sub, 'TEACHER_COURSE_ASSIGN', { teacherId, courseId });
    response.status(201).json({ teacherId, courseId });
  } catch (error) { next(error); }
}

async function listAllocations(request, response, next) {
  try {
    const [studentClasses] = await pool.execute(`
      SELECT sc.student_id, sc.class_id, u.full_name AS student_name, c.name AS class_name, c.code AS class_code
      FROM student_classes sc
      JOIN users u ON u.id = sc.student_id
      JOIN classes c ON c.id = sc.class_id
      ORDER BY u.full_name, c.name`);
    const [teacherClasses] = await pool.execute(`
      SELECT tc.teacher_id, tc.class_id, u.full_name AS teacher_name, c.name AS class_name, c.code AS class_code
      FROM teacher_classes tc
      JOIN users u ON u.id = tc.teacher_id
      JOIN classes c ON c.id = tc.class_id
      ORDER BY u.full_name, c.name`);
    const [teacherCourses] = await pool.execute(`
      SELECT tc.teacher_id, tc.course_id, u.full_name AS teacher_name, co.name AS course_name
      FROM teacher_courses tc
      JOIN users u ON u.id = tc.teacher_id
      JOIN courses co ON co.id = tc.course_id
      ORDER BY u.full_name, co.name`);
    response.json({ studentClasses, teacherClasses, teacherCourses });
  } catch (error) { next(error); }
}

async function unassignStudent(request, response, next) {
  try {
    const studentId = requirePositiveInteger(request.params.studentId, 'student id');
    const classId = requirePositiveInteger(request.params.classId, 'class id');
    const [result] = await pool.execute('DELETE FROM student_classes WHERE student_id = ? AND class_id = ?', [studentId, classId]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Allocation not found' });
    await recordAudit(request.user.sub, 'STUDENT_CLASS_UNASSIGN', { studentId, classId });
    response.status(204).send();
  } catch (error) { next(error); }
}

async function unassignTeacher(request, response, next) {
  try {
    const teacherId = requirePositiveInteger(request.params.teacherId, 'teacher id');
    const classId = requirePositiveInteger(request.params.classId, 'class id');
    const [result] = await pool.execute('DELETE FROM teacher_classes WHERE teacher_id = ? AND class_id = ?', [teacherId, classId]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Allocation not found' });
    await recordAudit(request.user.sub, 'TEACHER_CLASS_UNASSIGN', { teacherId, classId });
    response.status(204).send();
  } catch (error) { next(error); }
}

async function unassignCourse(request, response, next) {
  try {
    const teacherId = requirePositiveInteger(request.params.teacherId, 'teacher id');
    const courseId = requirePositiveInteger(request.params.courseId, 'course id');
    const [result] = await pool.execute('DELETE FROM teacher_courses WHERE teacher_id = ? AND course_id = ?', [teacherId, courseId]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Allocation not found' });
    await recordAudit(request.user.sub, 'TEACHER_COURSE_UNASSIGN', { teacherId, courseId });
    response.status(204).send();
  } catch (error) { next(error); }
}

async function auditLogs(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?', [limit, offset]);
    response.json({ logs: rows });
  } catch (error) { next(error); }
}

async function listUsers(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.query('SELECT id, username, full_name, role, status FROM users ORDER BY username LIMIT ? OFFSET ?', [limit, offset]);
    response.json({ users: rows });
  } catch (error) { next(error); }
}

async function updateUser(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'user id');
    const fullName = requireString(request.body.full_name, 'full_name', { max: 160 });
    const role = ['TEACHER', 'STUDENT'].includes(request.body.role) ? request.body.role : null;
    if (!role) return response.status(400).json({ error: 'role must be TEACHER or STUDENT' });
    const status = ['ACTIVE', 'INACTIVE'].includes(request.body.status) ? request.body.status : null;
    const [result] = status
      ? await pool.execute('UPDATE users SET full_name = ?, role = ?, status = ? WHERE id = ?', [fullName, role, status, id])
      : await pool.execute('UPDATE users SET full_name = ?, role = ? WHERE id = ?', [fullName, role, id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'User not found' });
    await recordAudit(request.user.sub, 'USER_UPDATE', { userId: id });
    response.json({ id, full_name: fullName, role, ...(status ? { status } : {}) });
  } catch (error) { next(error); }
}

async function deleteUser(request, response, next) {
  try {
    const id = requirePositiveInteger(request.params.id, 'user id');
    const [result] = await pool.execute("DELETE FROM users WHERE id = ?", [id]);
    if (!result.affectedRows) return response.status(404).json({ error: 'User not found' });
    await recordAudit(request.user.sub, 'USER_DELETE', { userId: id });
    response.status(204).send();
  } catch (error) { next(error); }
}

module.exports = { dashboard, listCourses, createCourse, updateCourse, deleteCourse, listClasses, createClass, getClass, updateClass, listUsers, createUser, updateUser, deleteUser, assignStudent, assignTeacher, assignCourse, listAllocations, unassignStudent, unassignTeacher, unassignCourse, auditLogs };
