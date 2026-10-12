const fs = require('fs');
const path = require('path');
const pool = require('../config/database');
const { recordAudit } = require('../services/audit.service');
const {
  requireString,
  requireOptionalString,
  requirePositiveInteger,
  requirePositiveIntegerArray,
  requireNumberInRange,
  requireSqlDateTime
} = require('../validators/common');
const { requireQuestionType, validateAnswerData } = require('../validators/quiz');

const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'];

function resolveImagePath(request) {
  return request.file ? `/uploads/${request.file.filename}` : null;
}

function unlinkImage(imagePath) {
  if (!imagePath) return;
  try {
    const absolute = path.join(__dirname, '../../..', imagePath);
    if (fs.existsSync(absolute)) fs.unlinkSync(absolute);
  } catch {
    /* best effort cleanup */
  }
}

async function invalidateQuizCaches(teacherId) {
  const { invalidateCache } = require('../config/redis');
  await invalidateCache(`teacher_quizzes:${teacherId}:*`);
  await invalidateCache(`student_quizzes:*`);
}

async function quizHasAttempts(quizId, submittedOnly = true) {
  const restriction = submittedOnly ? "AND status = 'SUBMITTED'" : '';
  const [rows] = await pool.execute(`SELECT 1 FROM quiz_attempts WHERE quiz_id = ? ${restriction} LIMIT 1`, [quizId]);
  return rows.length > 0;
}

async function dashboard(request, response, next) {
  try {
    const [courses] = await pool.execute('SELECT c.* FROM courses c JOIN teacher_courses tc ON tc.course_id = c.id WHERE tc.teacher_id = ?', [request.user.sub]);
    const [classes] = await pool.execute('SELECT c.* FROM classes c JOIN teacher_classes tc ON tc.class_id = c.id WHERE tc.teacher_id = ?', [request.user.sub]);
    response.json({ courses, classes });
  } catch (error) { next(error); }
}

async function listQuestionBank(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.execute('SELECT id, question_type, question_text, answer_data, difficulty, image_path FROM question_bank WHERE teacher_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [request.user.sub, limit, offset]);
    response.json({ questions: rows });
  } catch (error) { next(error); }
}

async function createQuestion(request, response, next) {
  try {
    const questionType = requireQuestionType(request.body.question_type);
    const questionText = requireString(request.body.question_text, 'question_text', { max: 5000 });
    const answerData = validateAnswerData(questionType, request.body.answer_data);
    const difficulty = DIFFICULTIES.includes(request.body.difficulty) ? request.body.difficulty : 'MEDIUM';
    const imagePath = resolveImagePath(request);
    const [result] = await pool.execute('INSERT INTO question_bank (teacher_id, question_type, question_text, answer_data, difficulty, image_path) VALUES (?, ?, ?, ?, ?, ?)', [request.user.sub, questionType, questionText, JSON.stringify(answerData), difficulty, imagePath]);
    await recordAudit(request.user.sub, 'QUESTION_CREATE', { questionId: result.insertId });
    response.status(201).json({ id: result.insertId, image_path: imagePath });
  } catch (error) { next(error); }
}

async function updateQuestion(request, response, next) {
  try {
    const questionId = requirePositiveInteger(request.params.id, 'question id');
    const [questions] = await pool.execute('SELECT * FROM question_bank WHERE id = ? AND teacher_id = ?', [questionId, request.user.sub]);
    if (!questions.length) return response.status(404).json({ error: 'Question not found' });
    const existing = questions[0];

    const [answerHits] = await pool.execute('SELECT 1 FROM quiz_attempt_answers WHERE question_id = ? LIMIT 1', [questionId]);
    if (answerHits.length) return response.status(409).json({ error: 'Question has submitted answers and cannot be edited' });

    const body = request.body || {};
    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

    const questionType = has('question_type') ? requireQuestionType(body.question_type) : existing.question_type;
    let answerData = null;
    if (has('answer_data')) {
      answerData = validateAnswerData(questionType, body.answer_data);
    } else if (has('question_type') && body.question_type !== existing.question_type) {
      return response.status(400).json({ error: 'answer_data is required when changing the question type' });
    }

    let imagePath = existing.image_path;
    if (request.file) {
      imagePath = resolveImagePath(request);
    } else if (has('image_path')) {
      if (body.image_path === null || body.image_path === '') {
        imagePath = null;
      } else if (typeof body.image_path === 'string' && body.image_path.startsWith('/uploads/')) {
        imagePath = body.image_path;
      } else {
        return response.status(400).json({ error: 'image_path must be null or a /uploads/ path' });
      }
    }

    const updates = [];
    const params = [];
    const apply = (clause, value) => { updates.push(clause); params.push(value); };

    if (has('question_text')) apply('question_text = ?', requireString(body.question_text, 'question_text', { max: 5000 }));
    if (has('question_type')) apply('question_type = ?', questionType);
    if (answerData !== null) apply('answer_data = ?', JSON.stringify(answerData));
    if (has('difficulty')) {
      if (!DIFFICULTIES.includes(body.difficulty)) return response.status(400).json({ error: 'difficulty must be EASY, MEDIUM, or HARD' });
      apply('difficulty = ?', body.difficulty);
    }
    if (imagePath !== existing.image_path) apply('image_path = ?', imagePath);

    if (!updates.length) return response.status(400).json({ error: 'No valid fields to update' });

    await pool.execute(`UPDATE question_bank SET ${updates.join(', ')} WHERE id = ? AND teacher_id = ?`, [...params, questionId, request.user.sub]);
    if (imagePath !== existing.image_path) unlinkImage(existing.image_path);
    await recordAudit(request.user.sub, 'QUESTION_UPDATE', { questionId, fields: updates.map((clause) => clause.split(' = ')[0]) });
    response.json({ id: questionId, image_path: imagePath });
  } catch (error) { next(error); }
}

async function deleteQuestion(request, response, next) {
  try {
    const questionId = requirePositiveInteger(request.params.id, 'question id');
    const [questions] = await pool.execute('SELECT image_path FROM question_bank WHERE id = ? AND teacher_id = ?', [questionId, request.user.sub]);
    if (!questions.length) return response.status(404).json({ error: 'Question not found' });

    const [answerHits] = await pool.execute('SELECT 1 FROM quiz_attempt_answers WHERE question_id = ? LIMIT 1', [questionId]);
    if (answerHits.length) return response.status(409).json({ error: 'Question has submitted answers and cannot be deleted' });
    const [attached] = await pool.execute('SELECT 1 FROM quiz_questions WHERE question_id = ? LIMIT 1', [questionId]);
    if (attached.length) return response.status(409).json({ error: 'Question is attached to a quiz; detach it first' });

    await pool.execute('DELETE FROM question_bank WHERE id = ? AND teacher_id = ?', [questionId, request.user.sub]);
    unlinkImage(questions[0].image_path);
    await recordAudit(request.user.sub, 'QUESTION_DELETE', { questionId });
    response.json({ id: questionId, deleted: true });
  } catch (error) { next(error); }
}

async function listQuizzes(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const cacheKey = `teacher_quizzes:${request.user.sub}:limit:${limit}:offset:${offset}`;
    const { getCache, setCache } = require('../config/redis');

    const cached = await getCache(cacheKey);
    if (cached) return response.json(cached);

    const [rows] = await pool.execute('SELECT * FROM quizzes WHERE creator_id = ? ORDER BY id DESC LIMIT ? OFFSET ?', [request.user.sub, limit, offset]);
    const data = { quizzes: rows };
    await setCache(cacheKey, data, 300);
    response.json(data);
  } catch (error) { next(error); }
}

async function createQuiz(request, response, next) {
  try {
    const title = requireString(request.body.title, 'title', { max: 180 });
    const courseId = requirePositiveInteger(request.body.course_id, 'course_id');
    const duration = requirePositiveInteger(request.body.duration_minutes, 'duration_minutes');
    const accessCode = requireOptionalString(request.body.access_code, 'access_code', { max: 120 });
    const attemptLimit = request.body.attempt_limit === undefined || request.body.attempt_limit === null
      ? 1
      : requirePositiveInteger(request.body.attempt_limit, 'attempt_limit');
    const passMark = request.body.pass_mark === undefined || request.body.pass_mark === null
      ? 50
      : requireNumberInRange(request.body.pass_mark, 'pass_mark', { min: 0, max: 100 });
    const startsAt = requireSqlDateTime(request.body.starts_at, 'starts_at');
    const endsAt = requireSqlDateTime(request.body.ends_at, 'ends_at');
    if (startsAt && endsAt && startsAt >= endsAt) return response.status(400).json({ error: 'starts_at must be before ends_at' });

    const [owned] = await pool.execute('SELECT 1 FROM teacher_courses WHERE teacher_id = ? AND course_id = ?', [request.user.sub, courseId]);
    if (!owned.length) return response.status(403).json({ error: 'Course is not assigned to this teacher' });

    const classIds = requirePositiveIntegerArray(request.body.class_ids, 'class_ids') || [];
    if (classIds.length) {
      const [ownedClasses] = await pool.execute(`SELECT class_id FROM teacher_classes WHERE teacher_id = ? AND class_id IN (${classIds.map(() => '?').join(',')})`, [request.user.sub, ...classIds]);
      if (ownedClasses.length !== classIds.length) return response.status(403).json({ error: 'Teacher is not assigned to every selected class' });
    }

    const [result] = await pool.execute('INSERT INTO quizzes (course_id, creator_id, title, duration_minutes, access_code, attempt_limit, pass_mark, randomize_questions, randomize_options, starts_at, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [courseId, request.user.sub, title, duration, accessCode, attemptLimit, passMark, Boolean(request.body.randomize_questions), Boolean(request.body.randomize_options), startsAt, endsAt]);
    for (const classId of classIds) await pool.execute('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, ?)', [result.insertId, classId]);
    await recordAudit(request.user.sub, 'QUIZ_CREATE', { quizId: result.insertId });

    await invalidateQuizCaches(request.user.sub);

    response.status(201).json({ id: result.insertId, title });
  } catch (error) { next(error); }
}

async function updateQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [owned] = await pool.execute('SELECT 1 FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!owned.length) return response.status(404).json({ error: 'Quiz not found' });
    if (await quizHasAttempts(quizId, true)) return response.status(409).json({ error: 'Quiz has submitted attempts and cannot be edited' });

    const body = request.body || {};
    const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

    const updates = [];
    const params = [];
    const apply = (clause, value) => { updates.push(clause); params.push(value); };
    let startsAtValue = null;
    let endsAtValue = null;

    if (has('title')) apply('title = ?', requireString(body.title, 'title', { max: 180 }));
    if (has('duration_minutes')) apply('duration_minutes = ?', requirePositiveInteger(body.duration_minutes, 'duration_minutes'));
    if (has('attempt_limit')) apply('attempt_limit = ?', requirePositiveInteger(body.attempt_limit, 'attempt_limit'));
    if (has('pass_mark')) apply('pass_mark = ?', requireNumberInRange(body.pass_mark, 'pass_mark', { min: 0, max: 100 }));
    if (has('access_code')) apply('access_code = ?', requireOptionalString(body.access_code, 'access_code', { max: 120 }));
    if (has('randomize_questions')) apply('randomize_questions = ?', Boolean(body.randomize_questions));
    if (has('randomize_options')) apply('randomize_options = ?', Boolean(body.randomize_options));
    if (has('starts_at')) {
      const start = requireSqlDateTime(body.starts_at, 'starts_at');
      params.push(start);
      updates.push('starts_at = ?');
      startsAtValue = start;
    }
    if (has('ends_at')) {
      const end = requireSqlDateTime(body.ends_at, 'ends_at');
      params.push(end);
      updates.push('ends_at = ?');
      endsAtValue = end;
    }

    if (!updates.length) return response.status(400).json({ error: 'No valid fields to update' });

    if (has('starts_at') && has('ends_at') && startsAtValue && endsAtValue && startsAtValue >= endsAtValue) {
      return response.status(400).json({ error: 'starts_at must be before ends_at' });
    }

    await pool.execute(`UPDATE quizzes SET ${updates.join(', ')} WHERE id = ? AND creator_id = ?`, [...params, quizId, request.user.sub]);

    if (has('class_ids')) {
      const classIds = requirePositiveIntegerArray(body.class_ids, 'class_ids') || [];
      if (classIds.length) {
        const [ownedClasses] = await pool.execute(`SELECT class_id FROM teacher_classes WHERE teacher_id = ? AND class_id IN (${classIds.map(() => '?').join(',')})`, [request.user.sub, ...classIds]);
        if (ownedClasses.length !== classIds.length) return response.status(403).json({ error: 'Teacher is not assigned to every selected class' });
      }
      await pool.execute('DELETE FROM quiz_classes WHERE quiz_id = ?', [quizId]);
      for (const classId of classIds) await pool.execute('INSERT INTO quiz_classes (quiz_id, class_id) VALUES (?, ?)', [quizId, classId]);
    }

    await invalidateQuizCaches(request.user.sub);
    await recordAudit(request.user.sub, 'QUIZ_UPDATE', { quizId, fields: updates.map((clause) => clause.split(' = ')[0]) });

    const [quizzes] = await pool.execute('SELECT * FROM quizzes WHERE id = ?', [quizId]);
    response.json({ id: quizId, quiz: quizzes[0] });
  } catch (error) { next(error); }
}

async function deleteQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [owned] = await pool.execute('SELECT 1 FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!owned.length) return response.status(404).json({ error: 'Quiz not found' });
    if (await quizHasAttempts(quizId, false)) return response.status(409).json({ error: 'Quiz has student attempts and cannot be deleted' });

    await pool.execute('DELETE FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    await pool.execute('DELETE FROM quizzes WHERE id = ?', [quizId]);
    await invalidateQuizCaches(request.user.sub);
    await recordAudit(request.user.sub, 'QUIZ_DELETE', { quizId });
    response.json({ id: quizId, deleted: true });
  } catch (error) { next(error); }
}

async function publishQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [ownedQuiz] = await pool.execute('SELECT id FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!ownedQuiz.length) return response.status(404).json({ error: 'Quiz not found' });
    const [questionCount] = await pool.execute('SELECT COUNT(*) AS total FROM quiz_questions WHERE quiz_id = ?', [quizId]);
    if (!questionCount[0].total) return response.status(409).json({ error: 'Quiz has no questions; attach at least one before publishing' });
    await pool.execute("UPDATE quizzes SET status = 'PUBLISHED' WHERE id = ? AND creator_id = ?", [quizId, request.user.sub]);
    await recordAudit(request.user.sub, 'QUIZ_PUBLISH', { quizId });

    await invalidateQuizCaches(request.user.sub);

    response.json({ id: quizId, status: 'PUBLISHED' });
  } catch (error) { next(error); }
}

async function closeQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [result] = await pool.execute("UPDATE quizzes SET status = 'CLOSED' WHERE id = ? AND creator_id = ?", [quizId, request.user.sub]);
    if (!result.affectedRows) return response.status(404).json({ error: 'Quiz not found' });

    await invalidateQuizCaches(request.user.sub);

    response.json({ id: quizId, status: 'CLOSED' });
  } catch (error) { next(error); }
}

async function addQuestionToQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const questionId = requirePositiveInteger(request.body.question_id, 'question_id');
    const [owned] = await pool.execute('SELECT 1 FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!owned.length) return response.status(404).json({ error: 'Quiz not found' });
    const [questionOwned] = await pool.execute('SELECT 1 FROM question_bank WHERE id = ? AND teacher_id = ?', [questionId, request.user.sub]);
    if (!questionOwned.length) return response.status(404).json({ error: 'Question not found' });
    const [alreadyAttached] = await pool.execute('SELECT 1 FROM quiz_questions WHERE quiz_id = ? AND question_id = ?', [quizId, questionId]);
    if (alreadyAttached.length) return response.status(409).json({ error: 'Question is already attached to this quiz' });
    await pool.execute('INSERT INTO quiz_questions (quiz_id, question_id, position) VALUES (?, ?, COALESCE((SELECT MAX(position) + 1 FROM quiz_questions q WHERE q.quiz_id = ?), 1))', [quizId, questionId, quizId]);
    response.status(201).json({ quizId, questionId });
  } catch (error) { next(error); }
}

async function detachQuestion(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const questionId = requirePositiveInteger(request.params.questionId, 'question id');
    const [owned] = await pool.execute('SELECT 1 FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!owned.length) return response.status(404).json({ error: 'Quiz not found' });
    if (await quizHasAttempts(quizId, true)) return response.status(409).json({ error: 'Quiz has submitted attempts and cannot be modified' });
    const [attached] = await pool.execute('SELECT 1 FROM quiz_questions WHERE quiz_id = ? AND question_id = ?', [quizId, questionId]);
    if (!attached.length) return response.status(404).json({ error: 'Question is not attached to this quiz' });
    await pool.execute('DELETE FROM quiz_questions WHERE quiz_id = ? AND question_id = ?', [quizId, questionId]);
    await recordAudit(request.user.sub, 'QUESTION_DETACH', { quizId, questionId });
    response.json({ quizId, questionId, removed: true });
  } catch (error) { next(error); }
}

async function getQuizDetail(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [quizzes] = await pool.execute('SELECT * FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!quizzes.length) return response.status(404).json({ error: 'Quiz not found' });
    const [questions] = await pool.execute(`
      SELECT qb.id, qb.question_type, qb.question_text, qb.difficulty, qb.image_path, qq.position
      FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id
      WHERE qq.quiz_id = ? ORDER BY qq.position`, [quizId]);
    const [classRows] = await pool.execute('SELECT class_id FROM quiz_classes WHERE quiz_id = ?', [quizId]);
    response.json({ quiz: quizzes[0], questions, class_ids: classRows.map((row) => row.class_id) });
  } catch (error) { next(error); }
}

async function statistics(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [owned] = await pool.execute('SELECT id FROM quizzes WHERE id = ? AND creator_id = ?', [quizId, request.user.sub]);
    if (!owned.length) return response.status(404).json({ error: 'Quiz not found' });
    const [rows] = await pool.execute('SELECT u.full_name, a.score, a.started_at, a.submitted_at FROM quiz_attempts a JOIN users u ON u.id = a.student_id JOIN quizzes q ON q.id = a.quiz_id WHERE a.quiz_id = ? AND q.creator_id = ? AND a.status = \'SUBMITTED\' ORDER BY a.score DESC', [quizId, request.user.sub]);
    const [questionStats] = await pool.execute(`
      SELECT qb.id AS question_id, qb.question_type, qb.question_text, qb.answer_data, qb.image_path, qq.position,
             COUNT(qaa.attempt_id) AS answered_count,
             COALESCE(SUM(qaa.is_correct), 0) AS correct_count
      FROM quiz_questions qq
      JOIN question_bank qb ON qb.id = qq.question_id
      LEFT JOIN quiz_attempt_answers qaa
        ON qaa.question_id = qb.id
       AND qaa.attempt_id IN (SELECT id FROM quiz_attempts WHERE quiz_id = ? AND status = 'SUBMITTED')
      WHERE qq.quiz_id = ?
      GROUP BY qb.id, qq.position
      ORDER BY qq.position`, [quizId, quizId]);
    response.json({ results: rows, questions: questionStats });
  } catch (error) { next(error); }
}

module.exports = { dashboard, listQuestionBank, createQuestion, updateQuestion, deleteQuestion, listQuizzes, createQuiz, updateQuiz, deleteQuiz, publishQuiz, closeQuiz, addQuestionToQuiz, detachQuestion, getQuizDetail, statistics };