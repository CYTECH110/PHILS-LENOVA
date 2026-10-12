import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth.js'
import OverviewPanel from './student/OverviewPanel.jsx'
import QuizzesPanel from './student/QuizzesPanel.jsx'
import HistoryPanel from './student/HistoryPanel.jsx'
import QuizRunner from './student/QuizRunner.jsx'
import ProfilePanel from './ProfilePanel.jsx'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'quizzes', label: 'Quizzes' },
  { id: 'history', label: 'History' },
  { id: 'profile', label: 'Profile' },
]

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [session, setSession] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleFinished() {
    setRefreshKey((key) => key + 1)
  }

  function handleExit() {
    setSession(null)
    setTab('quizzes')
    setRefreshKey((key) => key + 1)
  }

  if (session) {
    return (
      <div className="min-h-screen bg-slate-100">
        <QuizRunner
          session={session}
          locationStatus={session.locationStatus}
          onExit={handleExit}
          onFinished={handleFinished}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Learnova Student</h1>
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
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        {tab === 'overview' && <OverviewPanel refreshKey={refreshKey} />}
        {tab === 'quizzes' && (
          <QuizzesPanel
            onStarted={(nextSession) => {
              setSession(nextSession)
              setRefreshKey((key) => key + 1)
            }}
          />
        )}
        {tab === 'history' && <HistoryPanel />}
        {tab === 'profile' && <ProfilePanel />}
      </main>
    </div>
  )
}
