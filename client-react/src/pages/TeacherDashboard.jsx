import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import OverviewPanel from './teacher/OverviewPanel.jsx'
import QuestionBankPanel from './teacher/QuestionBankPanel.jsx'
import QuizzesPanel from './teacher/QuizzesPanel.jsx'
import ReportsPanel from './ReportsPanel.jsx'
import ProfilePanel from './ProfilePanel.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Question bank' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'reports', label: 'Reports' },
  { id: 'profile', label: 'Profile' },
]

export default function TeacherDashboard() {
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
            <h1 className="text-lg font-semibold text-slate-900">Learnova Teacher</h1>
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
        {tab === 'overview' && <OverviewPanel />}
        {tab === 'questions' && <QuestionBankPanel />}
        {tab === 'quizzes' && <QuizzesPanel />}
        {tab === 'reports' && <ReportsPanel />}
        {tab === 'profile' && <ProfilePanel />}
      </main>
    </div>
  )
}
