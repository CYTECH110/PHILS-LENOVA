-- Seed Users (1 admin, 2 teachers, 3 students)
-- Password for all users is 'password123'
-- Hash generated via bcrypt with a salt round of 10
INSERT INTO users (id, first_name, last_name, email, password_hash, role) VALUES
-- Admin (id: 1)
(1, 'Alice', 'Admin', 'admin@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'admin'),

-- Teachers (id: 2, 3)
(2, 'Bob', 'Teacher', 'bob.teacher@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'teacher'),
(3, 'Carol', 'Teacher', 'carol.teacher@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'teacher'),

-- Students (id: 4, 5, 6)
(4, 'David', 'Student', 'david.student@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'student'),
(5, 'Eve', 'Student', 'eve.student@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'student'),
(6, 'Frank', 'Student', 'frank.student@learnova.com', '$2b$10$Z/SgG7ykLBaC1gQIV5zMEuL1NhVFdl.98.lcJkCoc36VmWodtVZwa', 'student');

-- Reset the sequence for the users table since we manually inserted IDs 1 through 6
SELECT setval('users_id_seq', 6);

-- Seed Courses
-- Teacher Bob (id 2) teaches 'Introduction to Programming'
-- Teacher Carol (id 3) teaches 'Web Development Bootcamp'
INSERT INTO courses (id, title, description, teacher_id) VALUES
(1, 'Introduction to Programming', 'Learn the basics of logic and programming with Python.', 2),
(2, 'Web Development Bootcamp', 'A comprehensive guide to HTML, CSS, JS and React.', 3);

-- Reset sequence for courses
SELECT setval('courses_id_seq', 2);

-- Enroll Students
-- Enroll David (4) and Eve (5) in 'Introduction to Programming' (course 1)
-- Enroll Eve (5) and Frank (6) in 'Web Development Bootcamp' (course 2)
INSERT INTO enrollments (student_id, course_id) VALUES
(4, 1),
(5, 1),
(5, 2),
(6, 2);

-- Seed Assessments
-- 1 assessment per course
INSERT INTO assessments (course_id, title, description, max_score, due_date) VALUES
(1, 'Python Basics Quiz', 'A 10-question multiple choice quiz on Python variables and loops.', 100, CURRENT_TIMESTAMP + INTERVAL '7 days'),
(2, 'HTML/CSS Project', 'Build a personal portfolio website.', 100, CURRENT_TIMESTAMP + INTERVAL '14 days');
