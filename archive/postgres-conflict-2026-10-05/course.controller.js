const db = require('../config/database');

// GET: List all courses
const getAllCourses = async (req, res, next) => {
  try {
    // Join with users table to get the teacher's name
    const result = await db.query(`
      SELECT c.id, c.title, c.description, c.created_at, u.first_name AS teacher_first_name, u.last_name AS teacher_last_name 
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      ORDER BY c.created_at DESC
    `);
    
    return res.status(200).json({ courses: result.rows });
  } catch (error) {
    next(error);
  }
};

// GET: Get a single course by ID
const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(`
      SELECT c.id, c.title, c.description, c.created_at, u.first_name AS teacher_first_name, u.last_name AS teacher_last_name 
      FROM courses c
      JOIN users u ON c.teacher_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    return res.status(200).json({ course: result.rows[0] });
  } catch (error) {
    next(error);
  }
};

// POST: Create a new course
const createCourse = async (req, res, next) => {
  try {
    const { title, description } = req.body;
    
    // We get the teacher_id automatically from the logged-in user making the request!
    // This is safe because req.user is populated securely by our verifyToken middleware.
    const teacher_id = req.user.id; 

    if (!title) {
      return res.status(400).json({ error: 'Course title is required' });
    }

    const result = await db.query(`
      INSERT INTO courses (title, description, teacher_id) 
      VALUES ($1, $2, $3) 
      RETURNING *
    `, [title, description, teacher_id]);

    return res.status(201).json({
      message: 'Course created successfully',
      course: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllCourses,
  getCourseById,
  createCourse
};
