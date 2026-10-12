import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'
import UsersPanel from './admin/UsersPanel.jsx'
import CoursesPanel from './admin/CoursesPanel.jsx'
import ClassesPanel from './admin/ClassesPanel.jsx'
import AllocationsPanel from './admin/AllocationsPanel.jsx'
import AuditLogsPanel from './admin/AuditLogsPanel.jsx'
import ReportsPanel from './ReportsPanel.jsx'
import ProfilePanel from './ProfilePanel.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'courses', label: 'Courses' },
  { id: 'classes', label: 'Classes' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'reports', label: 'Reports' },
  { id: 'audit', label: 'Audit logs' },
  { id: 'profile', label: 'Profile' },
]

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

function Overview() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    let active = true
    api
      .getDashboard()
      .then((data) => {
        if (active) setStats(data)
      })
      .catch(() => {
        if (active) setStats(null)
      })
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <MetricCard label="Users" value={stats?.users} />
      <MetricCard label="Students" value={stats?.students} />
      <MetricCard label="Teachers" value={stats?.teachers} />
      <MetricCard label="Active courses" value={stats?.courses} />
      <MetricCard label="Classes" value={stats?.classes} />
    </div>
  )
}

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Learnova Admin</h1>
            <p className="text-sm text-slate-500">
              Signed in as <span className="font-medium">{user?.username}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={
                tab === item.id
                  ? 'border-b-2 border-indigo-600 px-3 py-2.5 text-sm font-medium whitespace-nowrap text-indigo-700'
                  : 'border-b-2 border-transparent px-3 py-2.5 text-sm font-medium whitespace-nowrap text-slate-500 transition hover:text-slate-800'
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {tab === 'overview' && <Overview />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'courses' && <CoursesPanel />}
        {tab === 'classes' && <ClassesPanel />}
        {tab === 'allocations' && <AllocationsPanel />}
        {tab === 'reports' && <ReportsPanel />}
        {tab === 'audit' && <AuditLogsPanel />}
        {tab === 'profile' && <ProfilePanel />}
      </main>
    </div>
  )
}
