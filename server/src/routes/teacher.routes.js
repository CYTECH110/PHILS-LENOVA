const express = require('express');
const controller = require('../controllers/teacher.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const pagination = require('../middleware/pagination');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(requireAuth, requireRole('TEACHER'));
router.get('/dashboard', controller.dashboard);
router.get('/question-bank', pagination, controller.listQuestionBank);
router.post('/question-bank', upload.single('image'), controller.createQuestion);
router.put('/question-bank/:id', upload.single('image'), controller.updateQuestion);
router.delete('/question-bank/:id', controller.deleteQuestion);
router.get('/quizzes', pagination, controller.listQuizzes);
router.post('/quizzes', controller.createQuiz);
router.get('/quizzes/:id', controller.getQuizDetail);
router.put('/quizzes/:id', controller.updateQuiz);
router.delete('/quizzes/:id', controller.deleteQuiz);
router.post('/quizzes/:id/questions', controller.addQuestionToQuiz);
router.delete('/quizzes/:id/questions/:questionId', controller.detachQuestion);
router.post('/quizzes/:id/publish', controller.publishQuiz);
router.post('/quizzes/:id/close', controller.closeQuiz);
router.get('/quizzes/:id/statistics', controller.statistics);

module.exports = router;
