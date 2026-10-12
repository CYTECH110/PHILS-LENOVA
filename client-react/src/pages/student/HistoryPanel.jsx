import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Pagination from '../../components/Pagination.jsx'

function formatWhen(value) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

const STATUS_STYLES = {
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  SUBMITTED: 'bg-emerald-50 text-emerald-700',
  EXPIRED: 'bg-slate-100 text-slate-600',
}

export default function HistoryPanel() {
  const { page, setPage, rows, loading, error, limit } = usePagedList(api.getHistory, 'history', {
    limit: 10,
  })

  return (
    <Panel title="Attempt history">
      {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
      {!error && (
        <>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Quiz</th>
                <th className="px-4 py-2 font-medium">Course</th>
                <th className="px-4 py-2 font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Result</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No attempts yet.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-800">{row.title}</td>
                    <td className="px-4 py-2 text-slate-600">{row.course_name || '—'}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {row.score === null || row.score === undefined ? '—' : row.score}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_STYLES[row.status] || 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {row.passed === null || row.passed === undefined ? (
                        '—'
                      ) : row.passed ? (
                        <span className="text-emerald-700">Passed</span>
                      ) : (
                        <span className="text-red-600">Not passed</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                      {formatWhen(row.submitted_at)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Pagination
            page={page}
            limit={limit}
            rowCount={rows.length}
            onPageChange={setPage}
            disabled={loading}
          />
        </>
      )}
    </Panel>
  )
}
