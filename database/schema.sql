CREATE DATABASE IF NOT EXISTS smartclass CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartclass;

CREATE TABLE users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  role ENUM('ADMIN', 'TEACHER', 'STUDENT') NOT NULL,
  email VARCHAR(255) NULL UNIQUE,
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE classes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) NOT NULL UNIQUE,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  radius_meters INT UNSIGNED NOT NULL DEFAULT 100,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE courses (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL UNIQUE,
  description TEXT,
  image_path VARCHAR(255),
  status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE student_classes (
  student_id BIGINT UNSIGNED NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (student_id, class_id),
  FOREIGN KEY (student_id) REFERENCES users(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE teacher_classes (
  teacher_id BIGINT UNSIGNED NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (teacher_id, class_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (class_id) REFERENCES classes(id)
);

CREATE TABLE teacher_courses (
  teacher_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (teacher_id, course_id),
  FOREIGN KEY (teacher_id) REFERENCES users(id),
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

CREATE TABLE quizzes (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  creator_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  status ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
  duration_minutes INT UNSIGNED NOT NULL,
  access_code VARCHAR(120),
  attempt_limit INT UNSIGNED NOT NULL DEFAULT 1,
  pass_mark DECIMAL(5, 2) NOT NULL DEFAULT 50.00,
  randomize_questions BOOLEAN NOT NULL DEFAULT FALSE,
  randomize_options BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at DATETIME,
  ends_at DATETIME,
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (creator_id) REFERENCES users(id)
);

CREATE TABLE quiz_classes (
  quiz_id BIGINT UNSIGNED NOT NULL,
  class_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (quiz_id, class_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
);

CREATE TABLE question_bank (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  teacher_id BIGINT UNSIGNED NOT NULL,
  question_type ENUM('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK') NOT NULL,
  question_text TEXT NOT NULL,
  answer_data JSON NOT NULL,
  difficulty ENUM('EASY', 'MEDIUM', 'HARD') NOT NULL DEFAULT 'MEDIUM',
  image_path VARCHAR(255),
  FOREIGN KEY (teacher_id) REFERENCES users(id)
);

CREATE TABLE quiz_questions (
  quiz_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY (quiz_id, question_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id),
  FOREIGN KEY (question_id) REFERENCES question_bank(id)
);

CREATE TABLE quiz_attempts (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  quiz_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  score DECIMAL(8, 2),
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  submitted_at DATETIME,
  status ENUM('IN_PROGRESS', 'SUBMITTED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
  passed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE KEY one_attempt_per_student (quiz_id, student_id),
  FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE quiz_attempt_answers (
  attempt_id BIGINT UNSIGNED NOT NULL,
  question_id BIGINT UNSIGNED NOT NULL,
  answer_text TEXT,
  is_correct BOOLEAN,
  points DECIMAL(8, 2) NOT NULL DEFAULT 0,
  feedback TEXT,
  PRIMARY KEY (attempt_id, question_id),
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES question_bank(id)
);

CREATE TABLE geofence_checks (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  attempt_id BIGINT UNSIGNED NOT NULL,
  latitude DECIMAL(10, 7),
  longitude DECIMAL(10, 7),
  accuracy_meters DECIMAL(8, 2),
  distance_meters DECIMAL(10, 2),
  allowed BOOLEAN NOT NULL,
  failure_reason VARCHAR(120),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  action VARCHAR(120) NOT NULL,
  details JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
