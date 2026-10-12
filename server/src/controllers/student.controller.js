const pool = require('../config/database');
const { recordAudit } = require('../services/audit.service');
const { checkLocation } = require('../services/geofence.service');
const { prepareQuestions } = require('../services/quiz.service');
const { requirePositiveInteger } = require('../validators/common');

function sanitizeQuestionRows(questionRows) {
  return questionRows.map((question) => {
    let options;
    if (question.question_type === 'MULTIPLE_CHOICE') {
      try {
        const parsed = question.answer_data ? JSON.parse(question.answer_data) : {};
        options = parsed.options || [];
      } catch (e) {
        options = undefined;
      }
    }
    const sanitized = { ...question };
    delete sanitized.answer_data;
    if (sanitized.correct_answer) delete sanitized.correct_answer;
    return { ...sanitized, options };
  });
}

function buildQuestionPayload(questionRows, quiz) {
  return prepareQuestions(sanitizeQuestionRows(questionRows), quiz);
}

function normalizeTextAnswer(value) {
  return String(value == null ? '' : value)
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function dashboard(request, response, next) {
  try {
    const [courses] = await pool.execute('SELECT DISTINCT c.* FROM courses c JOIN teacher_courses tc ON tc.course_id = c.id JOIN student_classes sc ON sc.class_id IN (SELECT class_id FROM student_classes WHERE student_id = ?) WHERE c.status = \'ACTIVE\'', [request.user.sub]);
    const [history] = await pool.execute('SELECT a.id, q.title, a.score, a.started_at, a.submitted_at FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.student_id = ? ORDER BY a.started_at DESC', [request.user.sub]);
    response.json({ courses, history });
  } catch (error) { next(error); }
}

async function availableQuizzes(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const cacheKey = `student_quizzes:${request.user.sub}:limit:${limit}:offset:${offset}`;
    const { getCache, setCache } = require('../config/redis');
    
    const cached = await getCache(cacheKey);
    if (cached) return response.json(cached);

    const [rows] = await pool.execute(`
      SELECT DISTINCT q.id, q.title, q.duration_minutes, q.access_code, q.starts_at, q.ends_at, c.name AS course_name
      FROM quizzes q
      JOIN courses c ON c.id = q.course_id
      JOIN quiz_classes qc ON qc.quiz_id = q.id
      JOIN student_classes sc ON sc.class_id = qc.class_id
      LEFT JOIN quiz_attempts a ON a.quiz_id = q.id AND a.student_id = ?
      WHERE sc.student_id = ? AND q.status = 'PUBLISHED'
        AND (q.starts_at IS NULL OR q.starts_at <= NOW())
        AND (q.ends_at IS NULL OR q.ends_at >= NOW())
        AND (a.id IS NULL OR a.status = 'IN_PROGRESS')
      ORDER BY q.ends_at, q.title LIMIT ? OFFSET ?`, [request.user.sub, request.user.sub, limit, offset]);
    
    const data = { quizzes: rows.map((row) => ({ ...row, access_code: undefined })) };
    await setCache(cacheKey, data, 300); // 5 minutes cache
    response.json(data);
  } catch (error) { next(error); }
}

async function startQuiz(request, response, next) {
  const connection = await pool.getConnection();
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [rows] = await connection.execute(`
      SELECT q.*, cl.id AS class_id, cl.latitude, cl.longitude, cl.radius_meters
      FROM quizzes q JOIN quiz_classes qc ON qc.quiz_id = q.id JOIN classes cl ON cl.id = qc.class_id
      JOIN student_classes sc ON sc.class_id = cl.id
      WHERE q.id = ? AND sc.student_id = ? AND q.status = 'PUBLISHED'`, [quizId, request.user.sub]);
    const quiz = rows[0];
    if (!quiz) return response.status(404).json({ error: 'Quiz is unavailable to this student' });
    const now = new Date();
    if (quiz.starts_at && new Date(quiz.starts_at) > now) {
      return response.status(403).json({ error: 'Quiz has not started yet' });
    }
    if (quiz.ends_at && new Date(quiz.ends_at) < now) {
      return response.status(403).json({ error: 'Quiz has ended' });
    }
    if (quiz.access_code && request.body.access_code !== quiz.access_code) return response.status(403).json({ error: 'Invalid access code' });
    let startLocation;
    if (quiz.latitude !== null && quiz.longitude !== null) {
      const latitude = Number(request.body.latitude);
      const longitude = Number(request.body.longitude);
      const accuracy = Number(request.body.accuracy_meters || 0);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return response.status(400).json({ error: 'Classroom location is required before starting this quiz' });
      const location = checkLocation({ latitude, longitude }, quiz);
      const allowed = location.allowed && (!accuracy || accuracy <= quiz.radius_meters);
      if (!allowed) return response.status(403).json({ error: 'You must be inside the assigned classroom to start this quiz' });
      startLocation = { latitude, longitude, accuracy, distance: location.distance };
    }
    const [attempts] = await connection.execute('SELECT * FROM quiz_attempts WHERE quiz_id = ? AND student_id = ?', [quizId, request.user.sub]);
    if (attempts.length && attempts[0].status !== 'IN_PROGRESS') return response.status(409).json({ error: 'Quiz attempt already submitted' });
    const attemptLimit = quiz.attempt_limit !== undefined && quiz.attempt_limit !== null ? Number(quiz.attempt_limit) : 1;
    const submittedAttempts = attempts.filter((a) => a.status === 'SUBMITTED').length;
    if (submittedAttempts >= attemptLimit) {
      return response.status(403).json({ error: 'Attempt limit reached for this quiz' });
    }
    let attempt = attempts[0];
    if (!attempt) {
      const [result] = await connection.execute('INSERT INTO quiz_attempts (quiz_id, student_id) VALUES (?, ?)', [quizId, request.user.sub]);
      attempt = { id: result.insertId, started_at: new Date() };
    }
    if (startLocation) {
      await connection.execute('INSERT INTO geofence_checks (attempt_id, latitude, longitude, accuracy_meters, distance_meters, allowed) VALUES (?, ?, ?, ?, ?, TRUE)', [attempt.id, startLocation.latitude, startLocation.longitude, startLocation.accuracy, startLocation.distance]);
    }
    const [questionRows] = await connection.execute(`
      SELECT qb.id, qb.question_type, qb.question_text, qb.answer_data, qb.image_path, qq.position
      FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id
      WHERE qq.quiz_id = ? ORDER BY qq.position`, [quizId]);
    response.json({ attempt: { id: attempt.id, started_at: attempt.started_at }, quiz: { id: quiz.id, title: quiz.title, duration_minutes: quiz.duration_minutes }, questions: buildQuestionPayload(questionRows, quiz) });
  } catch (error) { next(error); } finally { connection.release(); }
}

async function getQuiz(request, response, next) {
  try {
    const quizId = requirePositiveInteger(request.params.id, 'quiz id');
    const [rows] = await pool.execute(`
      SELECT q.id, q.title, q.duration_minutes, q.attempt_limit, q.pass_mark, q.starts_at, q.ends_at,
             q.access_code, q.randomize_questions, q.randomize_options, c.name AS course_name,
             cl.id AS class_id, cl.latitude, cl.longitude, cl.radius_meters
      FROM quizzes q
      JOIN courses c ON c.id = q.course_id
      JOIN quiz_classes qc ON qc.quiz_id = q.id
      JOIN classes cl ON cl.id = qc.class_id
      JOIN student_classes sc ON sc.class_id = cl.id
      WHERE q.id = ? AND sc.student_id = ? AND q.status = 'PUBLISHED'`, [quizId, request.user.sub]);
    const quiz = rows[0];
    if (!quiz) return response.status(404).json({ error: 'Quiz is unavailable to this student' });
    const now = new Date();
    if (quiz.starts_at && new Date(quiz.starts_at) > now) {
      return response.status(403).json({ error: 'Quiz has not started yet' });
    }
    if (quiz.ends_at && new Date(quiz.ends_at) < now) {
      return response.status(403).json({ error: 'Quiz has ended' });
    }
    if (quiz.access_code && request.query.access_code !== quiz.access_code) {
      return response.status(403).json({ error: 'Invalid access code' });
    }
    if (quiz.latitude !== null && quiz.longitude !== null) {
      const latitude = Number(request.query.latitude);
      const longitude = Number(request.query.longitude);
      const accuracy = Number(request.query.accuracy_meters || 0);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return response.status(400).json({ error: 'Classroom location is required to preview this quiz' });
      }
      const location = checkLocation({ latitude, longitude }, quiz);
      const allowed = location.allowed && (!accuracy || accuracy <= quiz.radius_meters);
      if (!allowed) return response.status(403).json({ error: 'You must be inside the assigned classroom to preview this quiz' });
    }
    const [questionRows] = await pool.execute(`
      SELECT qb.id, qb.question_type, qb.question_text, qb.answer_data, qb.image_path, qq.position
      FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id
      WHERE qq.quiz_id = ? ORDER BY qq.position`, [quizId]);
    const questions = buildQuestionPayload(questionRows, quiz);
    response.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        course_name: quiz.course_name,
        duration_minutes: quiz.duration_minutes,
        attempt_limit: quiz.attempt_limit,
        pass_mark: quiz.pass_mark,
        starts_at: quiz.starts_at,
        ends_at: quiz.ends_at,
        question_count: questions.length
      },
      questions
    });
  } catch (error) { next(error); }
}

async function verifyLocation(request, response, next) {
  try {
    const attemptId = requirePositiveInteger(request.params.id, 'attempt id');
    const latitude = Number(request.body.latitude);
    const longitude = Number(request.body.longitude);
    const accuracy = Number(request.body.accuracy_meters || 0);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return response.status(400).json({ error: 'Valid coordinates are required' });
    const [rows] = await pool.execute(`SELECT a.id, c.latitude, c.longitude, c.radius_meters FROM quiz_attempts a JOIN quiz_classes qc ON qc.quiz_id = a.quiz_id JOIN classes c ON c.id = qc.class_id WHERE a.id = ? AND a.student_id = ?`, [attemptId, request.user.sub]);
    const classroom = rows[0];
    if (!classroom || classroom.latitude === null || classroom.longitude === null) return response.status(409).json({ error: 'This class has no geofence configured' });
    const result = checkLocation({ latitude, longitude }, classroom);
    const allowed = result.allowed && (!accuracy || accuracy <= classroom.radius_meters);
    await pool.execute('INSERT INTO geofence_checks (attempt_id, latitude, longitude, accuracy_meters, distance_meters, allowed, failure_reason) VALUES (?, ?, ?, ?, ?, ?, ?)', [attemptId, latitude, longitude, accuracy, result.distance, allowed, allowed ? null : 'OUTSIDE_ALLOWED_AREA']);
    if (!allowed) return response.status(403).json({ allowed: false, error: 'You must be inside the assigned classroom to take this quiz' });
    response.json({ allowed: true, distance_meters: result.distance });
  } catch (error) { next(error); }
}

async function submitQuiz(request, response, next) {
  const connection = await pool.getConnection();
  try {
    const attemptId = requirePositiveInteger(request.params.id, 'attempt id');
    await connection.beginTransaction();
    const [attemptRows] = await connection.execute('SELECT a.*, q.duration_minutes, q.pass_mark, q.title FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id WHERE a.id = ? AND a.student_id = ? FOR UPDATE', [attemptId, request.user.sub]);
    const attempt = attemptRows[0];
    if (!attempt) return response.status(404).json({ error: 'Attempt not found' });
    if (attempt.status !== 'IN_PROGRESS') return response.status(409).json({ error: 'Attempt already submitted' });
    const elapsed = (Date.now() - new Date(attempt.started_at).getTime()) / 60000;
    const timeLimit = attempt.duration_minutes !== undefined && attempt.duration_minutes !== null ? Number(attempt.duration_minutes) : 0;
    if (timeLimit > 0 && elapsed > timeLimit + 1) return response.status(409).json({ error: 'Quiz time has expired' });
    const [questions] = await connection.execute('SELECT qb.id, qb.question_type, qb.answer_data FROM quiz_questions qq JOIN question_bank qb ON qb.id = qq.question_id WHERE qq.quiz_id = ?', [attempt.quiz_id]);
    const answers = Array.isArray(request.body.answers) ? request.body.answers : [];
    let score = 0;
    for (const question of questions) {
      const submitted = answers.find((answer) => Number(answer.question_id) === question.id);
      let data = {};
      try {
        data = question.answer_data ? JSON.parse(question.answer_data) : {};
      } catch (e) {
        data = {};
      }
      const answerText = submitted && typeof submitted.answer === 'string' ? submitted.answer.trim() : '';
      const expected = typeof data.correct_answer === 'string' ? data.correct_answer.trim() : '';
      const isCorrect = question.question_type === 'TRUE_FALSE' || question.question_type === 'SHORT_ANSWER' || question.question_type === 'FILL_BLANK'
        ? normalizeTextAnswer(answerText) === normalizeTextAnswer(expected)
        : answerText === expected;
      if (isCorrect) score += 1;
      await connection.execute('INSERT INTO quiz_attempt_answers (attempt_id, question_id, answer_text, is_correct, points) VALUES (?, ?, ?, ?, ?)', [attemptId, question.id, answerText, isCorrect, isCorrect ? 1 : 0]);
    }
    const passMark = attempt.pass_mark !== undefined && attempt.pass_mark !== null ? Number(attempt.pass_mark) : 50;
    const passed = questions.length > 0 && (score / questions.length) * 100 >= passMark;
    await connection.execute("UPDATE quiz_attempts SET score = ?, status = 'SUBMITTED', submitted_at = NOW(), passed = ? WHERE id = ?", [score, passed ? 1 : 0, attemptId]);
    await connection.commit();
    await recordAudit(request.user.sub, 'QUIZ_SUBMIT', { attemptId, score });

    const { invalidateCache } = require('../config/redis');
    await invalidateCache(`student_quizzes:*`);

    // Send email alert asynchronously
    const [userRows] = await pool.execute('SELECT full_name FROM users WHERE id = ?', [request.user.sub]);
    const { sendQuizSubmissionAlert } = require('../services/email.service');
    sendQuizSubmissionAlert(userRows[0]?.full_name || 'Student', attempt.title || 'Quiz', score);

    response.json({ attemptId, score, total: questions.length, passed });
  } catch (error) { await connection.rollback(); next(error); } finally { connection.release(); }
}

async function history(request, response, next) {
  try {
    const { limit, offset } = request.pagination;
    const [rows] = await pool.execute('SELECT a.*, q.title, c.name AS course_name FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id JOIN courses c ON c.id = q.course_id WHERE a.student_id = ? ORDER BY a.started_at DESC LIMIT ? OFFSET ?', [request.user.sub, limit, offset]); 
    response.json({ history: rows }); 
  } catch (error) { next(error); }
}

module.exports = { dashboard, availableQuizzes, getQuiz, startQuiz, verifyLocation, submitQuiz, history };
