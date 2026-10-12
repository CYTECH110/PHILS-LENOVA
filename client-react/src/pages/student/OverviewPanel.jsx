import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

export default function OverviewPanel({ refreshKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .getStudentDashboard()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [refreshKey])

  const courses = data?.courses || []
  const history = data?.history || []
  const scored = history.filter((row) => row.score !== null && row.score !== undefined)
  const average = scored.length
    ? Math.round((scored.reduce((sum, row) => sum + Number(row.score), 0) / scored.length) * 10) / 10
    : null

  if (error) return <p className="text-sm text-red-600">{error}</p>
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MetricCard label="Courses" value={courses.length} />
        <MetricCard label="Attempts" value={history.length} />
        <MetricCard label="Average score" value={average ?? '—'} />
        <MetricCard
          label="Passed"
          value={history.filter((row) => row.passed === 1 || row.passed === true).length}
        />
      </div>

      <section className="rounded-xl bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">My courses</h2>
        </header>
        {courses.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">
            No courses yet — ask your teacher to allocate you to a class.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {courses.map((course) => (
              <li key={course.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-medium text-slate-800">{course.name}</span>
                <span className="text-slate-500">{course.description || '—'}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl bg-white shadow-sm">
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">Recent attempts</h2>
        </header>
        {history.length === 0 ? (
          <p className="px-4 py-5 text-sm text-slate-500">No attempts yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {history.slice(0, 5).map((row) => (
              <li key={row.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-slate-700">{row.title}</span>
                <span className="text-slate-500">
                  {row.score ?? '—'} {row.submitted_at ? '' : '(in progress)'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
