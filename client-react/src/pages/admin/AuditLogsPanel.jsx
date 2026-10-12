import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Pagination from '../../components/Pagination.jsx'

function formatDetails(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function formatTimestamp(value) {
  if (!value) return '—'
  const date = new Date(String(value).replace(' ', 'T'))
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()
}

export default function AuditLogsPanel() {
  const { page, setPage, rows, loading, error, limit } = usePagedList(api.getAuditLogs, 'logs', {
    limit: 20,
  })
  const [openId, setOpenId] = useState(null)

  return (
    <Panel title="Audit logs">
      {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
      {!error && (
        <>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">ID</th>
                <th className="px-4 py-2 font-medium">When</th>
                <th className="px-4 py-2 font-medium">User</th>
                <th className="px-4 py-2 font-medium">Action</th>
                <th className="px-4 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No audit entries yet.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((log) => {
                  const details = formatDetails(log.details)
                  const expanded = openId === log.id
                  return (
                    <tr key={log.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-2 text-slate-500">{log.id}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {log.user_id ? `#${log.user_id}` : '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {log.action}
                        </span>
                      </td>
                      <td className="max-w-sm px-4 py-2 text-slate-600">
                        {details.length > 80 && !expanded ? (
                          <button
                            type="button"
                            className="text-left text-indigo-600 transition hover:text-indigo-800"
                            onClick={() => setOpenId(log.id)}
                          >
                            {details.slice(0, 80)}… (show)
                          </button>
                        ) : (
                          <span className="font-mono text-xs break-all">
                            {details}
                            {details.length > 80 && (
                              <button
                                type="button"
                                className="ml-2 text-indigo-600 transition hover:text-indigo-800"
                                onClick={() => setOpenId(null)}
                              >
                                (hide)
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
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
