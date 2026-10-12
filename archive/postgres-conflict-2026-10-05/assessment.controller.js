const db = require('../config/database');

// Create a new assessment (Quiz/Project)
const createAssessment = async (req, res, next) => {
  try {
    const { course_id, title, description, max_score, due_date } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({ error: 'course_id and title are required to create an assessment.' });
    }

    const result = await db.query(
      `INSERT INTO assessments (course_id, title, description, max_score, due_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [course_id, title, description, max_score, due_date]
    );

    return res.status(201).json({
      message: 'Assessment created successfully',
      assessment: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
};

// Submit a grade for a student's assessment
const submitGrade = async (req, res, next) => {
  try {
    const { assessment_id, student_id, score } = req.body;

    if (!assessment_id || !student_id || score === undefined) {
      return res.status(400).json({ error: 'assessment_id, student_id, and score are required.' });
    }

    const result = await db.query(
      `INSERT INTO submissions (assessment_id, student_id, score)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [assessment_id, student_id, score]
    );

    return res.status(201).json({
      message: 'Grade submitted successfully',
      submission: result.rows[0]
    });
  } catch (error) {
    // Catch PostgreSQL unique constraint violation (error code '23505')
    if (error.code === '23505') {
      return res.status(400).json({ 
        error: 'Submission failed: This student already has a grade for this assessment.' 
      });
    }
    next(error);
  }
};

module.exports = {
  createAssessment,
  submitGrade
};
