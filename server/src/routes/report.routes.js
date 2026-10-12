const express = require('express');
const controller = require('../controllers/report.controller');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Admins export everything; teachers export only their own quizzes (scoped in the controller).
router.use(requireAuth, requireRole('ADMIN', 'TEACHER'));

const REPORTS = ['attempts', 'quizzes', 'students'];
const FORMATS = ['csv', 'xlsx', 'pdf'];

for (const report of REPORTS) {
  for (const format of FORMATS) {
    router.get(`/${report}.${format}`, controller.download(report, format));
  }
}

module.exports = router;
