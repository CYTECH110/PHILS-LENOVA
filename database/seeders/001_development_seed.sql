USE smartclass;

INSERT INTO users (username, password_hash, full_name, role, email)
VALUES
  ('admin', '$2b$12$2AK13TAp61sD6zksPXNYE.ho2HNRoSAeYyu6V9hzcjlmkj3LMq0bu', 'System Administrator', 'ADMIN', 'admin@example.com'),
  ('teacher.demo', '$2b$12$2AK13TAp61sD6zksPXNYE.ho2HNRoSAeYyu6V9hzcjlmkj3LMq0bu', 'Demo Teacher', 'TEACHER', 'teacher.demo@example.com'),
  ('student.demo', '$2b$12$2AK13TAp61sD6zksPXNYE.ho2HNRoSAeYyu6V9hzcjlmkj3LMq0bu', 'Demo Student', 'STUDENT', 'student.demo@example.com');

INSERT INTO classes (name, code, latitude, longitude, radius_meters)
VALUES ('Demo Class', 'DEMO-001', 5.6037, -0.1870, 100);

INSERT INTO courses (name, description)
VALUES ('Web Development', 'HTML, CSS, JavaScript, and backend fundamentals');
