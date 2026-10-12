document.addEventListener('DOMContentLoaded', () => {
  // Ensure the apiClient has been loaded first
  if (!window.apiClient) {
    console.error('apiClient not found! Ensure api.js is loaded before admin.js');
    return;
  }

  // --- 1. Fetching Data ---
  const loadDashboard = async () => {
    try {
      // Fetch both Users and Courses at the same time using Promise.all for maximum speed
      const [usersResponse, coursesResponse] = await Promise.all([
        window.apiClient.getUsers(),
        window.apiClient.getCourses()
      ]);

      // Call our render functions and pass in the arrays (fallback to empty arrays if missing)
      renderUsers(usersResponse.users || []);
      renderCourses(coursesResponse.courses || []);
      
    } catch (error) {
      console.error('Dashboard Load Error:', error);
      alert('Failed to load dashboard data. Are you logged in as an admin?');
    }
  };

  // --- 2. Rendering the Users Table ---
  const renderUsers = (users) => {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return; // Exit if the HTML element isn't on the page

    tbody.innerHTML = ''; // Clear out any loading text

    users.forEach(user => {
      // Create the <tr> element in memory
      const tr = document.createElement('tr');
      // Give it a unique ID so we can easily target it for deletion later
      tr.id = `user-row-${user.id}`; 

      tr.innerHTML = `
        <td>${user.id}</td>
        <td>${user.first_name} ${user.last_name}</td>
        <td>${user.email}</td>
        <td><span class="role-badge">${user.role}</span></td>
        <td>
          <button class="delete-btn" data-id="${user.id}">Delete</button>
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Now that the buttons exist in the DOM, attach event listeners to them
    const deleteButtons = tbody.querySelectorAll('.delete-btn');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', handleDeleteUser);
    });
  };

  // --- 3. Rendering the Courses Table ---
  const renderCourses = (courses) => {
    const tbody = document.getElementById('courses-tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    courses.forEach(course => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${course.id}</td>
        <td>${course.title}</td>
        <td>${course.teacher_first_name} ${course.teacher_last_name}</td>
      `;
      tbody.appendChild(tr);
    });
  };

  // --- 4. Handling Deletion ---
  const handleDeleteUser = async (event) => {
    // Always ask for confirmation before a destructive action!
    if (!confirm('Are you absolutely sure you want to delete this user?')) return;

    const button = event.target;
    const userId = button.getAttribute('data-id'); // Read the ID we attached to the button

    // Disable the button immediately so the user doesn't double-click it
    button.disabled = true;
    button.textContent = 'Deleting...';

    try {
      // Call our API to delete it on the backend
      await window.apiClient.deleteUser(userId);

      // It succeeded! Now simply pluck the row out of the DOM. 
      // No page refresh required!
      const row = document.getElementById(`user-row-${userId}`);
      if (row) {
        row.remove();
      }
      
    } catch (error) {
      alert(`Failed to delete user: ${error.message}`);
      // If it failed, re-enable the button so they can try again
      button.disabled = false;
      button.textContent = 'Delete';
    }
  };

  // Kick off the loading process!
  loadDashboard();
});
