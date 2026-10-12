const db = require('../config/database');

const enrollStudent = async (req, res, next) => {
  try {
    const { student_id, course_id } = req.body;

    if (!student_id || !course_id) {
      return res.status(400).json({ error: 'student_id and course_id are required.' });
    }

    const result = await db.query(
      `INSERT INTO enrollments (student_id, course_id)
       VALUES ($1, $2)
       RETURNING *`,
      [student_id, course_id]
    );

    return res.status(201).json({
      message: 'Student enrolled successfully',
      enrollment: result.rows[0]
    });
  } catch (error) {
    // 23505 is the PostgreSQL error code for unique_violation
    // This perfectly catches when a student tries to enroll in a course they are already in
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Enrollment failed: Student is already enrolled in this course.' 
      });
    }
    
    // Pass any other unexpected errors to the global error handler
    next(error);
  }
};

module.exports = {
  enrollStudent
};
