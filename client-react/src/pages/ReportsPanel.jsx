import { useState } from 'react'
import { api } from '../lib/api.js'
import Panel from '../components/Panel.jsx'
import { buttonPrimary, buttonSecondary } from '../components/Field.jsx'

const REPORTS = [
  {
    id: 'attempts',
    title: 'Quiz attempts',
    description: 'One row per attempt with student, quiz, course, score, status and timestamps.',
  },
  {
    id: 'quizzes',
    title: 'Quiz summary',
    description: 'Per-quiz totals: attempts, submitted, average score, best score and pass rate.',
  },
  {
    id: 'students',
    title: 'Student summary',
    description: 'Per-student totals: attempts, submitted, average score, best score and passes.',
  },
]

const FORMATS = [
  { id: 'csv', label: 'CSV', primary: false },
  { id: 'xlsx', label: 'Excel', primary: false },
  { id: 'pdf', label: 'PDF', primary: true },
]

function ReportCard({ report }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  async function run(format) {
    setBusy(format)
    setError(null)
    try {
      await api.downloadReport(report.id, format)
    } catch (err) {
      setError(err.message || 'Unable to download report')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Panel
      title={report.title}
      action={
        <div className="flex flex-wrap gap-2">
          {FORMATS.map((format) => (
            <button
              key={format.id}
              type="button"
              onClick={() => run(format.id)}
              disabled={busy !== null}
              className={format.primary ? buttonPrimary : buttonSecondary}
            >
              {busy === format.id ? 'Preparing…' : `${format.label}`}
            </button>
          ))}
        </div>
      }
    >
      <div className="px-4 py-4">
        <p className="text-sm text-slate-600">{report.description}</p>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    </Panel>
  )
}

export default function ReportsPanel() {
  return (
    <div className="space-y-4">
      {REPORTS.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  )
}
