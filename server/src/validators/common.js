function requireString(value, field, options = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  const min = options.min || 1;
  const max = options.max || 255;

  if (text.length < min || text.length > max) {
    const error = new Error(`${field} must be between ${min} and ${max} characters`);
    error.statusCode = 400;
    throw error;
  }

  return text;
}

function requirePositiveInteger(value, field) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    const error = new Error(`${field} must be a positive integer`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function requireOptionalString(value, field, options = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be a string`);
    error.statusCode = 400;
    throw error;
  }
  const text = value.trim();
  const max = options.max || 255;
  if (text.length > max) {
    const error = new Error(`${field} must be at most ${max} characters`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function requireOptionalEmail(value, field = 'email', options = {}) {
  const text = requireOptionalString(value, field, { max: options.max || 255 });
  if (text === null) return null;
  if (!EMAIL_PATTERN.test(text)) {
    const error = new Error(`${field} must be a valid email address`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

function requireNumberInRange(value, field, { min, max }) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    const error = new Error(`${field} must be a number between ${min} and ${max}`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function requireSqlDateTime(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    const error = new Error(`${field} must be a valid datetime`);
    error.statusCode = 400;
    throw error;
  }
  let normalized = value.trim().replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(normalized)) normalized = `${normalized}:00`;
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized) || Number.isNaN(Date.parse(normalized))) {
    const error = new Error(`${field} must be a valid datetime (YYYY-MM-DD HH:MM:SS)`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}

function requirePositiveIntegerArray(value, field, { maxItems = 50 } = {}) {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value) || value.length > maxItems) {
    const error = new Error(`${field} must be an array of positive integers (max ${maxItems})`);
    error.statusCode = 400;
    throw error;
  }
  for (const entry of value) {
    if (!Number.isInteger(Number(entry)) || Number(entry) <= 0) {
      const error = new Error(`${field} must be an array of positive integers`);
      error.statusCode = 400;
      throw error;
    }
  }
  return value.map((entry) => Number(entry));
}

module.exports = { requireString, requirePositiveInteger, requireOptionalString, requireOptionalEmail, requireNumberInRange, requireSqlDateTime, requirePositiveIntegerArray };
