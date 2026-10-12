import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import Panel from '../../components/Panel.jsx'

function MetricCard({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-slate-900">{value ?? '—'}</p>
    </div>
  )
}

function ListCard({ title, emptyText, items, labeler }) {
  return (
    <Panel title={title}>
      <div className="px-4 py-3">
        {items.length === 0 && <p className="text-sm text-slate-500">{emptyText}</p>}
        {items.length > 0 && (
          <ul className="divide-y divide-slate-100 text-sm">
            {items.map((item) => (
              <li key={item.id} className="py-2 text-slate-700">
                {labeler(item)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

export default function OverviewPanel() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .getTeacherDashboard()
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  if (error) {
    return (
      <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </p>
    )
  }
  if (!data) return <p className="text-sm text-slate-500">Loading…</p>

  const courses = data.courses || []
  const classes = data.classes || []

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <MetricCard label="Assigned courses" value={courses.length} />
        <MetricCard label="Assigned classes" value={classes.length} />
      </div>

      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Quizzes can only be created under an assigned course, and a quiz becomes visible to students
        only after you attach at least one question and publish it from the Quizzes tab.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <ListCard
          title="Courses"
          emptyText="No courses assigned yet — ask an admin to allocate you to a course."
          items={courses}
          labeler={(course) => `#${course.id} — ${course.name}`}
        />
        <ListCard
          title="Classes"
          emptyText="No classes assigned yet — ask an admin to allocate you to a class."
          items={classes}
          labeler={(item) => `#${item.id} — ${item.name} (${item.code})`}
        />
      </div>
    </div>
  )
}
