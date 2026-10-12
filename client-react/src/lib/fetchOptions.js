import { api } from './api.js'

const PAGE_LIMIT = 100
const MAX_PAGES = 20

export async function fetchAll(fetcher, key) {
  const all = []
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const data = await fetcher(page, PAGE_LIMIT)
    const rows = data[key] || []
    all.push(...rows)
    if (rows.length < PAGE_LIMIT) break
  }
  return all
}

export async function fetchUsersByRole(role) {
  const users = await fetchAll(api.getUsers, 'users')
  const wanted = String(role).toUpperCase()
  return users.filter((user) => String(user.role).toUpperCase() === wanted)
}

export async function fetchAdminOptions() {
  const [students, teachers, classes, courses] = await Promise.all([
    fetchUsersByRole('STUDENT'),
    fetchUsersByRole('TEACHER'),
    fetchAll(api.getClasses, 'classes'),
    fetchAll(api.getAdminCourses, 'courses'),
  ])
  return { students, teachers, classes, courses }
}
