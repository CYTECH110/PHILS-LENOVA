const pool = require('../config/database');

async function recordAudit(userId, action, details = {}) {
  await pool.execute(
    'INSERT INTO audit_logs (user_id, action, details) VALUES (?, ?, ?)',
    [userId || null, action, JSON.stringify(details)]
  );
}

module.exports = { recordAudit };
