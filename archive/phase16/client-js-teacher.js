document.addEventListener('DOMContentLoaded', () => {
  if (!window.apiClient) {
    console.error('apiClient not found! Make sure api.js is loaded first.');
    return;
  }

  // DOM Elements
  const coursesContainer = document.getElementById('courses-container');
  const createCourseForm = document.getElementById('create-course-form');
  const courseModal = document.getElementById('course-modal');
  const openModalBtn = document.getElementById('open-modal-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');

  // --- 1. Fetch and render teacher's courses ---
  const loadDashboard = async () => {
    try {
      // Fetch only the courses owned by this teacher
      const response = await window.apiClient.getTeacherCourses();
      renderCourses(response.courses || []);
    } catch (error) {
      console.error('Failed to load courses:', error);
      alert('Could not load your courses. Please try logging in again.');
    }
  };

  // Helper function to generate a single Course Card DOM element
  const createCourseCard = (course) => {
    const card = document.createElement('div');
    card.className = 'course-card'; // Add CSS class for styling
    card.id = `course-card-${course.id}`;
    
    // Fallback date safely
    const dateString = course.created_at ? new Date(course.created_at).toLocaleDateString() : 'Just now';

    card.innerHTML = `
      <h3>${course.title}</h3>
      <p>${course.description || 'No description provided.'}</p>
      <div class="card-footer">
        <small>Created: ${dateString}</small>
      </div>
    `;
    return card;
  };

  // Clears the container and appends all cards
  const renderCourses = (courses) => {
    if (!coursesContainer) return;
    coursesContainer.innerHTML = ''; // Clear out loading text
    
    courses.forEach(course => {
      const card = createCourseCard(course);
      coursesContainer.appendChild(card);
    });
  };

  // --- 2. Modal Open/Close Logic ---
  if (openModalBtn && courseModal) {
    openModalBtn.addEventListener('click', () => {
      courseModal.style.display = 'block'; // Show modal
    });
  }

  if (closeModalBtn && courseModal) {
    closeModalBtn.addEventListener('click', () => {
      courseModal.style.display = 'none'; // Hide modal
      if(createCourseForm) createCourseForm.reset(); // Clear inputs
    });
  }

  // --- 3. Handle Form Submission (Create Course) ---
  if (createCourseForm) {
    createCourseForm.addEventListener('submit', async (event) => {
      event.preventDefault(); // Stop page refresh

      const title = document.getElementById('course-title').value.trim();
      const description = document.getElementById('course-description').value.trim();
      const submitBtn = createCourseForm.querySelector('button[type="submit"]');

      // Disable button during network request
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        // Send POST request via centralized ApiClient
        const response = await window.apiClient.createCourse(title, description);
        
        // Grab the newly created course object returned from the server
        const newCard = createCourseCard(response.course);
        
        // Prepend it to the DOM so it instantly appears at the TOP of the list
        if (coursesContainer) {
          coursesContainer.prepend(newCard);
        }

        // Hide the modal and clear the form on success
        if (courseModal) {
          courseModal.style.display = 'none';
        }
        createCourseForm.reset();

      } catch (error) {
        alert(`Failed to create course: ${error.message}`);
      } finally {
        // Always re-enable the button when done (success or fail)
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Course';
      }
    });
  }

  // Kickoff the initial fetch!
  loadDashboard();
});
