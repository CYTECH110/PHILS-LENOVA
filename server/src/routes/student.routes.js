const express = require('express');
const controller = require('../controllers/student.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const pagination = require('../middleware/pagination');

const router = express.Router();
router.use(requireAuth, requireRole('STUDENT'));
router.get('/dashboard', controller.dashboard);
router.get('/quizzes', pagination, controller.availableQuizzes);
router.get('/quizzes/:id', controller.getQuiz);
router.post('/quizzes/:id/start', controller.startQuiz);
router.post('/attempts/:id/location', controller.verifyLocation);
router.post('/attempts/:id/submit', controller.submitQuiz);
router.get('/history', pagination, controller.history);

module.exports = router;
