const QUESTION_TYPES = ['MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'];

function requireQuestionType(value) {
  if (!QUESTION_TYPES.includes(value)) {
    const error = new Error(`Invalid question type`);
    error.statusCode = 400;
    throw error;
  }
  return value;
}

function parseAnswerData(raw, field) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw || '{}');
    } catch {
      const error = new Error(`${field} must be valid JSON`);
      error.statusCode = 400;
      throw error;
    }
  }
  return raw || {};
}

function requireCorrectAnswer(expected, field) {
  if (typeof expected !== 'string' || expected.trim().length === 0) {
    const error = new Error(`${field} requires a correct_answer`);
    error.statusCode = 400;
    throw error;
  }
  return expected.trim();
}

function validateAnswerData(questionType, raw) {
  const data = parseAnswerData(raw, 'answer_data');

  if (questionType === 'MULTIPLE_CHOICE') {
    if (!Array.isArray(data.options) || data.options.length < 2 || data.options.length > 10) {
      const error = new Error('Multiple choice questions need between 2 and 10 options');
      error.statusCode = 400;
      throw error;
    }
    const options = data.options.map((option) => (typeof option === 'string' ? option.trim() : ''));
    if (options.some((option) => option.length === 0 || option.length > 500)) {
      const error = new Error('Every option must be a non-empty string of at most 500 characters');
      error.statusCode = 400;
      throw error;
    }
    const correctAnswer = requireCorrectAnswer(data.correct_answer, 'answer_data');
    if (!options.includes(correctAnswer)) {
      const error = new Error('correct_answer must match one of the options');
      error.statusCode = 400;
      throw error;
    }
    return { options, correct_answer: correctAnswer };
  }

  if (questionType === 'TRUE_FALSE') {
    const correctAnswer = requireCorrectAnswer(data.correct_answer, 'answer_data').toUpperCase();
    if (correctAnswer !== 'TRUE' && correctAnswer !== 'FALSE') {
      const error = new Error('True/false questions need a correct_answer of TRUE or FALSE');
      error.statusCode = 400;
      throw error;
    }
    return { correct_answer: correctAnswer };
  }

  if (questionType === 'SHORT_ANSWER' || questionType === 'FILL_BLANK') {
    const correctAnswer = requireCorrectAnswer(data.correct_answer, 'answer_data');
    if (correctAnswer.length > 500) {
      const error = new Error('correct_answer must be at most 500 characters');
      error.statusCode = 400;
      throw error;
    }
    return { correct_answer: correctAnswer };
  }

  const error = new Error('Invalid question type');
  error.statusCode = 400;
  throw error;
}

module.exports = { QUESTION_TYPES, requireQuestionType, validateAnswerData };