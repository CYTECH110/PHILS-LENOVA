import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_meters: position.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  })
}

function isLocationError(message) {
  return (
    message.includes('classroom') ||
    message.includes('location') ||
    message.includes('Location') ||
    message.includes('coordinates')
  )
}

function StartDialog({ quiz, onClose, onStarted }) {
  const [accessCode, setAccessCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [locationNote, setLocationNote] = useState('')

  async function handleStart() {
    setBusy(true)
    setError('')
    setLocationNote('')
    try {
      const position = await getPosition()
      if (position) setLocationNote('Location captured — checking the classroom geofence…')
      else setLocationNote('Location unavailable — continuing without it…')

      const payload = { access_code: accessCode.trim() }
      if (position) Object.assign(payload, position)

      let session
      let status = 'unavailable'
      try {
        session = await api.startQuiz(quiz.id, payload)
      } catch (err) {
        if (!position && isLocationError(err.message)) {
          setError(
            'This quiz requires your classroom location. Allow location access for this site (the lock icon in the address bar) and try again.'
          )
          return
        }
        throw err
      }

      if (position) {
        try {
          const check = await api.verifyLocation(session.attempt.id, position)
          if (check.allowed) {
            status = 'verified'
            setLocationNote(`Location verified (${Math.round(check.distance_meters ?? 0)} m from centre)`)
          }
        } catch {
          setLocationNote('Location could not be re-verified — the quiz will continue.')
        }
      }

      onStarted({ ...session, locationStatus: status })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={quiz.title} onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-slate-500">Course</dt>
            <dd className="font-medium text-slate-800">{quiz.course_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-slate-800">{quiz.duration_minutes} minutes</dd>
          </div>
          {quiz.ends_at && (
            <div className="col-span-2">
              <dt className="text-slate-500">Closes</dt>
              <dd className="font-medium text-slate-800">{String(quiz.ends_at)}</dd>
            </div>
          )}
        </dl>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {locationNote && !error && (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {locationNote}
          </p>
        )}

        <Field
          label="Access code"
          htmlFor="quiz-access-code"
          hint="Only required if your teacher set one for this quiz."
        >
          <input
            id="quiz-access-code"
            className={inputClass}
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            autoComplete="off"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={buttonPrimary} onClick={handleStart} disabled={busy}>
            {busy ? 'Starting…' : 'Start quiz'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

export default function QuizzesPanel({ onStarted }) {
  const { page, setPage, rows, loading, error, limit } = usePagedList(
    api.getAvailableQuizzes,
    'quizzes'
  )
  const [starting, setStarting] = useState(null)

  return (
    <>
      <Panel title="Available quizzes">
        {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
        {!error && (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Quiz</th>
                  <th className="px-4 py-2 font-medium">Course</th>
                  <th className="px-4 py-2 font-medium">Duration</th>
                  <th className="px-4 py-2 font-medium">Window</th>
                  <th className="px-4 py-2 text-right font-medium">Action</th>
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
                      No quizzes are available right now.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((quiz) => (
                    <tr key={quiz.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-slate-800">{quiz.title}</td>
                      <td className="px-4 py-2 text-slate-600">{quiz.course_name || '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{quiz.duration_minutes} min</td>
                      <td className="px-4 py-2 text-slate-600">
                        {quiz.starts_at || quiz.ends_at
                          ? `${quiz.starts_at ?? 'now'} → ${quiz.ends_at ?? 'no limit'}`
                          : 'Open'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="text-indigo-600 transition hover:text-indigo-800"
                          onClick={() => setStarting(quiz)}
                        >
                          Start
                        </button>
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

      {starting && (
        <StartDialog
          quiz={starting}
          onClose={() => setStarting(null)}
          onStarted={(session) => {
            setStarting(null)
            onStarted(session)
          }}
        />
      )}
    </>
  )
}
