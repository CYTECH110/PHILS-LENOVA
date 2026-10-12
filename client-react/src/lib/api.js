const BASE_URL = '/api'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

async function ensureCsrfToken() {
  let token = getCookie('learnova_csrf')
  if (token) return token

  const response = await fetch('/api/csrf-token', {
    method: 'GET',
    credentials: 'include',
  })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(data.error || 'Unable to initialize CSRF protection', response.status)
  }

  token = data.csrfToken
  if (!token) {
    throw new ApiError('CSRF token was not received from the server', response.status)
  }

  return token
}

export async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('/') ? endpoint : `${BASE_URL}/${endpoint}`
  const method = (options.method || 'GET').toUpperCase()
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  const config = {
    ...options,
    credentials: 'include',
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    },
  }

  if (method !== 'GET' && method !== 'HEAD') {
    config.headers['x-csrf-token'] = await ensureCsrfToken()
  }

  const response = await fetch(url, config)
  const data = await response.json().catch(() => ({}))

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'))
    throw new ApiError(data.error || 'Your session has expired. Please sign in again.', 401)
  }

  if (!response.ok) {
    throw new ApiError(data.error || 'An API error occurred', response.status)
  }

  return data
}

export async function downloadReport(report, format) {
  const response = await fetch(`${BASE_URL}/reports/${report}.${format}`, {
    credentials: 'include',
  })

  if (response.status === 401) {
    window.dispatchEvent(new Event('auth:unauthorized'))
    throw new ApiError('Your session has expired. Please sign in again.', 401)
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new ApiError(data.error || 'Unable to download report', response.status)
  }

  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') || ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const filename = match ? match[1] : `learnova-${report}.${format}`

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  request,
  downloadReport,
  login: (username, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  getSession: async () => {
    try {
      const data = await request('/api/auth/me')
      return data.user || null
    } catch {
      return null
    }
  },
  updateProfile: (fields) =>
    request('/api/auth/profile', { method: 'PUT', body: JSON.stringify(fields) }),
  changePassword: (currentPassword, newPassword) =>
    request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  forgotPassword: (email) =>
    request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  // Admin
  getDashboard: () => request('/api/admin/dashboard'),
  getUsers: (page = 1, limit = 20) => request(`/api/admin/users?page=${page}&limit=${limit}`),
  createUser: (fields) =>
    request('/api/admin/users', { method: 'POST', body: JSON.stringify(fields) }),
  updateUser: (id, fields) =>
    request(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  getAdminCourses: (page = 1, limit = 20) =>
    request(`/api/admin/courses?page=${page}&limit=${limit}`),
  createCourse: (fields) =>
    request('/api/admin/courses', { method: 'POST', body: JSON.stringify(fields) }),
  updateCourse: (id, fields) =>
    request(`/api/admin/courses/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  deleteCourse: (id) => request(`/api/admin/courses/${id}`, { method: 'DELETE' }),
  getClasses: (page = 1, limit = 20) =>
    request(`/api/admin/classes?page=${page}&limit=${limit}`),
  getClass: (id) => request(`/api/admin/classes/${id}`),
  createClass: (fields) =>
    request('/api/admin/classes', { method: 'POST', body: JSON.stringify(fields) }),
  updateClass: (id, fields) =>
    request(`/api/admin/classes/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  getAllocations: () => request('/api/admin/allocations'),
  assignStudent: (studentId, classId) =>
    request('/api/admin/allocations/students', {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId, class_id: classId }),
    }),
  assignTeacher: (teacherId, classId) =>
    request('/api/admin/allocations/teachers', {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId, class_id: classId }),
    }),
  assignCourse: (teacherId, courseId) =>
    request('/api/admin/allocations/courses', {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId, course_id: courseId }),
    }),
  unassignStudent: (studentId, classId) =>
    request(`/api/admin/allocations/students/${studentId}/classes/${classId}`, {
      method: 'DELETE',
    }),
  unassignTeacher: (teacherId, classId) =>
    request(`/api/admin/allocations/teachers/${teacherId}/classes/${classId}`, {
      method: 'DELETE',
    }),
  unassignCourse: (teacherId, courseId) =>
    request(`/api/admin/allocations/courses/${teacherId}/courses/${courseId}`, {
      method: 'DELETE',
    }),
  getAuditLogs: (page = 1, limit = 20) =>
    request(`/api/admin/audit-logs?page=${page}&limit=${limit}`),

  // Teacher
  getTeacherDashboard: () => request('/api/teacher/dashboard'),
  getQuestionBank: (page = 1, limit = 20) =>
    request(`/api/teacher/question-bank?page=${page}&limit=${limit}`),
  createQuestion: (fields, imageFile) => {
    const form = new FormData()
    form.append('question_type', fields.question_type)
    form.append('question_text', fields.question_text)
    form.append('answer_data', JSON.stringify(fields.answer_data))
    if (fields.difficulty) form.append('difficulty', fields.difficulty)
    if (imageFile) form.append('image', imageFile)
    return request('/api/teacher/question-bank', { method: 'POST', body: form })
  },
  updateQuestion: (id, fields, imageFile) => {
    const form = new FormData()
    form.append('question_type', fields.question_type)
    form.append('question_text', fields.question_text)
    form.append('answer_data', JSON.stringify(fields.answer_data))
    if (fields.difficulty) form.append('difficulty', fields.difficulty)
    if (imageFile) form.append('image', imageFile)
    if (fields.clear_image) form.append('image_path', '')
    return request(`/api/teacher/question-bank/${id}`, { method: 'PUT', body: form })
  },
  deleteQuestion: (id) => request(`/api/teacher/question-bank/${id}`, { method: 'DELETE' }),
  getTeacherQuizzes: (page = 1, limit = 20) =>
    request(`/api/teacher/quizzes?page=${page}&limit=${limit}`),
  createQuiz: (fields) =>
    request('/api/teacher/quizzes', { method: 'POST', body: JSON.stringify(fields) }),
  updateQuiz: (id, fields) =>
    request(`/api/teacher/quizzes/${id}`, { method: 'PUT', body: JSON.stringify(fields) }),
  deleteQuiz: (id) => request(`/api/teacher/quizzes/${id}`, { method: 'DELETE' }),
  addQuestionToQuiz: (quizId, questionId) =>
    request(`/api/teacher/quizzes/${quizId}/questions`, {
      method: 'POST',
      body: JSON.stringify({ question_id: questionId }),
    }),
  detachQuestion: (quizId, questionId) =>
    request(`/api/teacher/quizzes/${quizId}/questions/${questionId}`, { method: 'DELETE' }),
  getTeacherQuiz: (quizId) => request(`/api/teacher/quizzes/${quizId}`),
  publishQuiz: (quizId) => request(`/api/teacher/quizzes/${quizId}/publish`, { method: 'POST' }),
  closeQuiz: (quizId) => request(`/api/teacher/quizzes/${quizId}/close`, { method: 'POST' }),
  getQuizStatistics: (quizId) => request(`/api/teacher/quizzes/${quizId}/statistics`),

  // Student
  getStudentDashboard: () => request('/api/student/dashboard'),
  getAvailableQuizzes: (page = 1, limit = 20) =>
    request(`/api/student/quizzes?page=${page}&limit=${limit}`),
  startQuiz: (quizId, payload) =>
    request(`/api/student/quizzes/${quizId}/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyLocation: (attemptId, payload) =>
    request(`/api/student/attempts/${attemptId}/location`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  submitQuiz: (attemptId, answers) =>
    request(`/api/student/attempts/${attemptId}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    }),
  getHistory: (page = 1, limit = 20) =>
    request(`/api/student/history?page=${page}&limit=${limit}`),
}