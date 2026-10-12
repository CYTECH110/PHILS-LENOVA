const express = require('express');
const router = express.Router();
const courseController = require('../controllers/course.controller');
const { verifyToken, requireRole } = require('../middleware/jwt');

// 1. Apply verifyToken to ALL routes in this file.
// Every request passing through here MUST have a valid JWT cookie.
router.use(verifyToken);

// GET /api/courses -> List all courses (Accessible by any logged-in user: admin, teacher, student)
router.get('/', courseController.getAllCourses);

// GET /api/courses/:id -> Get specific course details (Accessible by any logged-in user)
router.get('/:id', courseController.getCourseById);

// POST /api/courses -> Create a new course
// 2. Apply requireRole strictly to the POST route.
// Only users with the role 'admin' or 'teacher' can create courses.
router.post('/', requireRole(['admin', 'teacher']), courseController.createCourse);

module.exports = router;
