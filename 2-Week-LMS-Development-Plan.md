# 🚀 2-Week Development Plan: PHILS LEARNOVA LMS

This roadmap is designed for a beginner to build a full system (Backend + Frontend) in 14 days. 

> [!TIP]
> **Golden Rule for Beginners:** Do not get stuck trying to make things look perfect. Focus on making them *work* first. You can always make it prettier later!

---

## Phase 1: Backend & Database (Days 1–5)
*Goal: Get the server running and capable of saving/retrieving data.*

*   **Day 1: Database Design & Setup**
    *   Design your database tables (e.g., `Users`, `Quizzes`, `Reports`).
    *   Set up a local MySQL database.
    *   Connect your Express app to MySQL using `config/database.js`.
*   **Day 2: Authentication & Security**
    *   Implement user Registration and Login (`auth.controller.js` & `auth.service.js`).
    *   Hash passwords using `bcrypt` before saving them to the database.
    *   Generate and issue a JWT (JSON Web Token) upon successful login.
*   **Day 3: Role-Based Routing (Admin & Teacher)**
    *   Create endpoints for Admins to create Teachers.
    *   Create endpoints for Teachers to create Students and Quizzes.
    *   Protect these routes using your `middleware/jwt.js` so only authorized users can access them.
*   **Day 4: Core LMS Features (Student & Quizzes)**
    *   Write the logic for Students to view and submit quizzes (`quiz.service.js`).
    *   Write the logic to generate reports/grades after a quiz is taken (`report.service.js`).
*   **Day 5: API Testing**
    *   Download an API testing tool like **Postman** or **Insomnia**.
    *   Test every single endpoint (Login, Create Quiz, Take Quiz) to ensure your backend works perfectly before touching the frontend.

---

## Phase 2: Frontend Development (Days 6–10)
*Goal: Build the visual interface that users will interact with.*
*(Note: Using a modern tool like React + Vite is highly recommended, paired with TailwindCSS for easy styling).*

*   **Day 6: Frontend Setup & Navigation**
    *   Initialize your frontend project (e.g., `npm create vite@latest client`).
    *   Create basic empty pages/views: Login, Admin Dashboard, Teacher Dashboard, Student Dashboard.
    *   Set up routing to navigate between these pages.
*   **Day 7: Connecting Auth (Frontend to Backend)**
    *   Build the Login form UI.
    *   Make an HTTP request (using `fetch` or `axios`) from your frontend to your backend `/api/auth/login`.
    *   Save the JWT token in the browser and redirect the user to their respective dashboard based on their role.
*   **Day 8: Teacher & Admin Dashboards**
    *   Build forms for Teachers to create quizzes and send that data to the backend.
    *   Build tables/lists to display students and their scores.
*   **Day 9: Student Dashboard**
    *   Build the view for students to see available quizzes.
    *   Build the interactive quiz form for students to answer questions and submit them.
*   **Day 10: Error Handling & UI Polish**
    *   Add loading spinners when fetching data.
    *   Show error messages (e.g., "Wrong password") nicely on the screen.
    *   Improve the design (colors, spacing, typography).

---

## Phase 3: Advanced Features & Launch (Days 11–14)
*Goal: Finish remaining features, catch bugs, and put the app on the internet.*

*   **Day 11: Geofencing & Auditing**
    *   Implement your custom Geofence feature (`geofence.service.js`) to restrict access based on user location if required.
    *   Finish the `audit.service.js` to log important actions (like when a teacher deletes a quiz).
*   **Day 12: End-to-End (E2E) Testing**
    *   Pretend to be a real user. Start from a fresh database, log in as Admin, create a Teacher, log out, log in as Teacher, create a Quiz and a Student, log out, log in as Student, and take the quiz.
    *   Fix any bugs you encounter during this flow.
*   **Day 13: Production Preparation**
    *   Ensure no sensitive data (like database passwords) is hardcoded; use your `.env` file.
    *   Build the frontend for production.
*   **Day 14: Deployment 🚀**
    *   Deploy your MySQL Database (e.g., using Aiven or PlanetScale).
    *   Deploy your Backend Node.js server (e.g., using Render, Railway, or Heroku).
    *   Deploy your Frontend (e.g., using Vercel or Netlify).
    *   Celebrate!
