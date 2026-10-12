import { createContext } from 'react'

export const ROLE_HOMES = {
  ADMIN: '/admin',
  TEACHER: '/teacher',
  STUDENT: '/student',
}

export const AuthContext = createContext(null)