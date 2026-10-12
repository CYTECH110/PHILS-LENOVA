const ROLE_HOMES = {
  ADMIN: '/pages/admin/index.html',
  TEACHER: '/pages/teacher/index.html',
  STUDENT: '/pages/student/index.html'
};

class ApiClient {
  constructor(baseURL = '/api') {
    this.baseURL = baseURL;
  }

  getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
  }

  async ensureCsrfToken() {
    let token = this.getCookie('learnova_csrf');
    if (token) return token;

    const response = await fetch('/api/csrf-token', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Unable to initialize CSRF protection');
    }

    token = data.csrfToken;
    if (!token) {
      throw new Error('CSRF token was not received from the server');
    }

    return token;
  }

  async request(endpoint, options = {}) {
    let url;
    if (endpoint.startsWith('/api/')) {
      url = endpoint;
    } else if (endpoint.startsWith('api/')) {
      url = `/${endpoint}`;
    } else if (endpoint.startsWith(this.baseURL)) {
      url = endpoint;
    } else {
      url = `${this.baseURL}${endpoint}`;
    }
    const method = (options.method || 'GET').toUpperCase();
    const config = {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      }
    };

    if (method !== 'GET' && method !== 'HEAD') {
      config.headers['x-csrf-token'] = await this.ensureCsrfToken();
    }

    try {
      const response = await fetch(url, config);

      const data = await response.json().catch(() => ({}));

      if (response.status === 401) {
        const onLoginPage = window.location.pathname.endsWith('/login.html');
        const isLoginCall = endpoint.startsWith('/auth/login');
        if (!onLoginPage && !isLoginCall) {
          window.location.replace('/login.html');
        }
        return Promise.reject(new Error(data.error || 'Your session has expired. Please sign in again.'));
      }

      if (!response.ok) {
        return Promise.reject(new Error(data.error || 'An API error occurred'));
      }

      return data;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error);
      throw error;
    }
  }

  async login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async getSession() {
    try {
      const response = await fetch(`${this.baseURL}/auth/me`, { credentials: 'include' });
      if (!response.ok) return null;
      const data = await response.json().catch(() => ({}));
      return data.user || null;
    } catch (error) {
      return null;
    }
  }

  async requireRole(role) {
    const user = await this.getSession();
    const home = user ? ROLE_HOMES[String(user.role || '').toUpperCase()] : null;

    if (!user || !home) {
      window.location.replace('/login.html');
      return null;
    }

    if (home !== ROLE_HOMES[String(role || '').toUpperCase()]) {
      window.location.replace(home);
      return null;
    }

    return user;
  }

  async signOut() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login.html';
    }
  }

  async getCourses() {
    return this.request('/admin/courses', { method: 'GET' });
  }

  async getTeacherCourses() {
    return this.request('/teacher/dashboard', { method: 'GET' });
  }

  async createCourse(title, description) {
    return this.request('/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ name: title, description })
    });
  }

  async getStudentCourses() {
    return this.request('/student/dashboard', { method: 'GET' });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ApiClient;
} else if (typeof window !== 'undefined') {
  window.apiClient = new ApiClient('/api');
  window.LearnovaApi = {
    apiRequest: (endpoint, options) => window.apiClient.request(endpoint, options),
    signOut: () => window.apiClient.signOut(),
    requireRole: (role) => window.apiClient.requireRole(role)
  };
}
