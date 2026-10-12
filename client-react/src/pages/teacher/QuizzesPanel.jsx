import { useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

const STATUS_CLASS = {
  DRAFT: 'bg-slate-100 text-slate-600',
  PUBLISHED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-red-50 text-red-700',
}

const TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  FILL_BLANK: 'Fill in the blank',
}

function toSqlDateTime(value) {
  return value ? `${value.replace('T', ' ')}:00` : null
}

function toLocalInput(value) {
  if (!value) return ''
  const text = String(value).replace('T', ' ')
  return text.length >= 16 ? `${text.slice(0, 10)}T${text.slice(11, 16)}` : ''
}

function formatSchedule(row) {
  if (!row.starts_at && !row.ends_at) return 'Always open'
  const start = row.starts_at ? String(row.starts_at).replace('T', ' ') : 'open'
  const end = row.ends_at ? String(row.ends_at).replace('T', ' ') : 'no end'
  return `${start} → ${end}`
}

function useTeacherAssignments() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let active = true
    api
      .getTeacherDashboard()
      .then((result) => {
        if (active) setData(result)
      })
      .catch(() => {
        if (active) setData({ courses: [], classes: [] })
      })
    return () => {
      active = false
    }
  }, [])
  return data
}

function QuizFormModal({ quiz, classIds: initialClassIds, assignments, onClose, onSaved }) {
  const editing = Boolean(quiz)
  const [title, setTitle] = useState(quiz?.title || '')
  const [courseId, setCourseId] = useState(quiz ? String(quiz.course_id) : '')
  const [classIds, setClassIds] = useState(initialClassIds || [])
  const [duration, setDuration] = useState(quiz?.duration_minutes ?? 30)
  const [attemptLimit, setAttemptLimit] = useState(quiz?.attempt_limit ?? 1)
  const [passMark, setPassMark] = useState(quiz ? Number(quiz.pass_mark) : 50)
  const [accessCode, setAccessCode] = useState(quiz?.access_code || '')
  const [randomizeQuestions, setRandomizeQuestions] = useState(Boolean(quiz?.randomize_questions))
  const [randomizeOptions, setRandomizeOptions] = useState(Boolean(quiz?.randomize_options))
  const [startsAt, setStartsAt] = useState(toLocalInput(quiz?.starts_at))
  const [endsAt, setEndsAt] = useState(toLocalInput(quiz?.ends_at))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const courses = assignments?.courses || []
  const classes = assignments?.classes || []

  const toggleClass = (classId) =>
    setClassIds((current) =>
      current.includes(classId) ? current.filter((id) => id !== classId) : [...current, classId]
    )

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!courseId) {
      setError('Pick a course.')
      return
    }
    setSaving(true)
    try {
      const payload = {
        title: title.trim(),
        class_ids: classIds,
        duration_minutes: Number(duration),
        attempt_limit: Number(attemptLimit),
        pass_mark: Number(passMark),
        access_code: accessCode.trim() || null,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        starts_at: toSqlDateTime(startsAt),
        ends_at: toSqlDateTime(endsAt),
      }
      if (editing) {
        await api.updateQuiz(quiz.id, payload)
      } else {
        await api.createQuiz({ ...payload, course_id: Number(courseId) })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit quiz' : 'Create quiz'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {!editing && courses.length === 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            You have no assigned courses yet — ask an admin to allocate you to one before creating
            quizzes.
          </p>
        )}

        {editing && (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            The course of a quiz cannot be changed after creation.
          </p>
        )}

        <Field label="Title" htmlFor="quiz-title">
          <input
            id="quiz-title"
            className={inputClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            required
          />
        </Field>

        <Field label="Course" htmlFor="quiz-course">
          <select
            id="quiz-course"
            className={inputClass}
            value={courseId}
            onChange={(event) => setCourseId(event.target.value)}
            required
            disabled={editing}
          >
            <option value="">Select a course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                #{course.id} — {course.name}
              </option>
            ))}
            {editing && !courses.some((course) => String(course.id) === String(courseId)) && (
              <option value={courseId}>#{courseId}</option>
            )}
          </select>
        </Field>

        <fieldset>
          <legend className="text-sm font-medium text-slate-700">
            Classes that can take this quiz
          </legend>
          {classes.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              No assigned classes — the quiz will keep no class links.
            </p>
          )}
          <div className="mt-1 space-y-1">
            {classes.map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={classIds.includes(item.id)}
                  onChange={() => toggleClass(item.id)}
                />
                #{item.id} — {item.name} ({item.code})
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Duration (min)" htmlFor="quiz-duration">
            <input
              id="quiz-duration"
              type="number"
              min="1"
              className={inputClass}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              required
            />
          </Field>
          <Field label="Attempt limit" htmlFor="quiz-attempts">
            <input
              id="quiz-attempts"
              type="number"
              min="1"
              className={inputClass}
              value={attemptLimit}
              onChange={(event) => setAttemptLimit(event.target.value)}
              required
            />
          </Field>
          <Field
            label="Pass mark (%)"
            htmlFor="quiz-pass-mark"
            hint="Percentage of correct answers required to pass (0–100)."
          >
            <input
              id="quiz-pass-mark"
              type="number"
              min="0"
              max="100"
              className={inputClass}
              value={passMark}
              onChange={(event) => setPassMark(event.target.value)}
              required
            />
          </Field>
        </div>

        <Field
          label="Access code (optional)"
          htmlFor="quiz-access-code"
          hint="Students must type this code to start. Leave blank for open access."
        >
          <input
            id="quiz-access-code"
            className={inputClass}
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
            maxLength={120}
            autoComplete="off"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens at (optional)" htmlFor="quiz-starts-at">
            <input
              id="quiz-starts-at"
              type="datetime-local"
              className={inputClass}
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </Field>
          <Field label="Closes at (optional)" htmlFor="quiz-ends-at">
            <input
              id="quiz-ends-at"
              type="datetime-local"
              className={inputClass}
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </Field>
        </div>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={randomizeQuestions}
              onChange={(event) => setRandomizeQuestions(event.target.checked)}
            />
            Randomize question order
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={randomizeOptions}
              onChange={(event) => setRandomizeOptions(event.target.checked)}
            />
            Randomize answer options
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="submit"
            className={buttonPrimary}
            disabled={saving || (!editing && courses.length === 0)}
          >
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create quiz'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function QuizQuestionsModal({ quiz, onClose }) {
  const [detail, setDetail] = useState(null)
  const [bankRows, setBankRows] = useState([])
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)

  const attachedIds = (detail?.questions || []).map((question) => question.id)

  function load() {
    Promise.all([api.getTeacherQuiz(quiz.id), api.getQuestionBank(1, 50)])
      .then(([quizDetail, bank]) => {
        setDetail(quizDetail)
        setBankRows(bank.questions || [])
        setError('')
      })
      .catch((err) => setError(err.message))
  }

  useEffect(load, [quiz.id])

  async function handleAdd(questionId) {
    setBusyId(questionId)
    try {
      await api.addQuestionToQuiz(quiz.id, questionId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  async function handleDetach(questionId) {
    setBusyId(questionId)
    try {
      await api.detachQuestion(quiz.id, questionId)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Modal title={`Questions — ${quiz.title}`} onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {!detail && !error && <p className="text-sm text-slate-500">Loading…</p>}

        {detail && (
          <>
            <section>
              <h3 className="text-sm font-medium text-slate-700">
                Attached ({detail.questions.length})
              </h3>
              {detail.questions.length === 0 && (
                <p className="mt-1 text-xs text-amber-700">
                  No questions yet — a quiz cannot be published until it has at least one.
                </p>
              )}
              <ul className="mt-1 divide-y divide-slate-100">
                {detail.questions.map((question, index) => (
                  <li key={question.id} className="flex items-start justify-between gap-3 py-2 text-sm text-slate-700">
                    <span>
                      <span className="mr-2 text-slate-400">{index + 1}.</span>
                      {question.question_text}
                      <span className="ml-2 text-xs text-slate-400">
                        {TYPE_LABELS[question.question_type] || question.question_type} ·{' '}
                        {question.difficulty}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="text-red-600 transition hover:text-red-800 disabled:opacity-60"
                      disabled={busyId === question.id}
                      onClick={() => handleDetach(question.id)}
                    >
                      {busyId === question.id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-medium text-slate-700">Add from question bank</h3>
              {bankRows.length === 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Your question bank is empty — create questions in the Question bank tab first.
                </p>
              )}
              <ul className="mt-1 max-h-64 divide-y divide-slate-100 overflow-y-auto">
                {bankRows.map((question) => {
                  const attached = attachedIds.includes(question.id)
                  return (
                    <li key={question.id} className="flex items-start justify-between gap-3 py-2">
                      <span className="text-sm text-slate-700">
                        {question.question_text}
                        <span className="ml-2 text-xs text-slate-400">
                          {TYPE_LABELS[question.question_type] || question.question_type}
                        </span>
                      </span>
                      <button
                        type="button"
                        className={attached ? buttonSecondary : buttonPrimary}
                        disabled={attached || busyId === question.id}
                        onClick={() => handleAdd(question.id)}
                      >
                        {attached ? 'Attached' : busyId === question.id ? 'Adding…' : 'Add'}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}

function QuestionStatsTable({ questions }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Question</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Correct answers</th>
            <th className="px-3 py-2 font-medium">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {questions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                This quiz has no questions.
              </td>
            </tr>
          )}
          {questions.map((question, index) => {
            const answered = Number(question.answered_count)
            const correct = Number(question.correct_count)
            const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : null
            const data = (() => {
              try {
                return JSON.parse(question.answer_data || '{}')
              } catch {
                return {}
              }
            })()
            return (
              <tr key={question.question_id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 text-slate-500">{question.position ?? index + 1}</td>
                <td className="max-w-xs px-3 py-2 text-slate-800">
                  {question.question_text}
                  {data.correct_answer && (
                    <span className="mt-0.5 block text-xs text-emerald-700">
                      Correct: {data.correct_answer}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {TYPE_LABELS[question.question_type] || question.question_type}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {correct} / {answered}
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {accuracy === null ? '—' : `${accuracy}%`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function QuizStatsModal({ quiz, onClose }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api
      .getQuizStatistics(quiz.id)
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [quiz.id])

  const results = data?.results || []
  const scores = results.map((row) => Number(row.score))
  const average =
    scores.length > 0 ? (scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1) : null
  const best = scores.length > 0 ? Math.max(...scores) : null

  return (
    <Modal title={`Statistics — ${quiz.title}`} onClose={onClose}>
      <div className="space-y-4">
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        {!data && !error && <p className="text-sm text-slate-500">Loading…</p>}

        {data && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Submitted attempts</p>
                <p className="mt-0.5 text-2xl font-semibold text-slate-900">{results.length}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Average score</p>
                <p className="mt-0.5 text-2xl font-semibold text-slate-900">
                  {average ?? '—'}
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Best score</p>
                <p className="mt-0.5 text-2xl font-semibold text-slate-900">{best ?? '—'}</p>
              </div>
            </div>

            <section>
              <h3 className="text-sm font-medium text-slate-700">Per-question breakdown</h3>
              <div className="mt-1">
                <QuestionStatsTable questions={data.questions || []} />
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium text-slate-700">Student results</h3>
              {results.length === 0 ? (
                <p className="mt-1 text-xs text-slate-500">
                  No submitted attempts yet — results appear after a student submits.
                </p>
              ) : (
                <ul className="mt-1 divide-y divide-slate-100">
                  {results.map((row, index) => (
                    <li
                      key={`${row.full_name}-${index}`}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="text-slate-700">{row.full_name}</span>
                      <span className="text-slate-500">
                        score {row.score}
                        {row.submitted_at
                          ? ` · ${String(row.submitted_at).replace('T', ' ')}`
                          : ' · not submitted'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function QuizzesPanel() {
  const { page, setPage, rows, loading, error, limit, reload } = usePagedList(
    api.getTeacherQuizzes,
    'quizzes'
  )
  const assignments = useTeacherAssignments()
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [managingQuestions, setManagingQuestions] = useState(null)
  const [viewingStats, setViewingStats] = useState(null)
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState(null)

  async function runAction(quizId, action) {
    setActionError('')
    setBusyId(quizId)
    try {
      if (action === 'publish') await api.publishQuiz(quizId)
      if (action === 'close') await api.closeQuiz(quizId)
      reload()
    } catch (err) {
      setActionError(
        action === 'publish' && /no questions/i.test(err.message)
          ? 'Attach at least one question before publishing.'
          : err.message
      )
    } finally {
      setBusyId(null)
    }
  }

  async function openEdit(quiz) {
    setActionError('')
    try {
      const detail = await api.getTeacherQuiz(quiz.id)
      setEditing({ quiz, classIds: detail.class_ids || [] })
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <Panel
        title="Quizzes"
        action={
          <button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
            + New quiz
          </button>
        }
      >
        {actionError && (
          <p
            role="alert"
            className="mx-4 mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {actionError}
          </p>
        )}
        {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
        {!error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">ID</th>
                    <th className="px-4 py-2 font-medium">Title</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Duration</th>
                    <th className="px-4 py-2 font-medium">Pass mark</th>
                    <th className="px-4 py-2 font-medium">Code</th>
                    <th className="px-4 py-2 font-medium">Schedule</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-slate-500">
                        No quizzes yet — create one, attach questions, then publish.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows.map((quiz) => (
                      <tr key={quiz.id} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-500">{quiz.id}</td>
                        <td className="px-4 py-2 font-medium text-slate-800">{quiz.title}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_CLASS[quiz.status] || STATUS_CLASS.DRAFT
                            }`}
                          >
                            {quiz.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{quiz.duration_minutes} min</td>
                        <td className="px-4 py-2 text-slate-600">{quiz.pass_mark}</td>
                        <td className="px-4 py-2 text-slate-600">{quiz.access_code || '—'}</td>
                        <td className="px-4 py-2 text-slate-600">{formatSchedule(quiz)}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex flex-wrap justify-end gap-3">
                            <button
                              type="button"
                              className="text-indigo-600 transition hover:text-indigo-800"
                              onClick={() => setManagingQuestions(quiz)}
                            >
                              Questions
                            </button>
                            <button
                              type="button"
                              className="text-indigo-600 transition hover:text-indigo-800"
                              onClick={() => setViewingStats(quiz)}
                            >
                              Stats
                            </button>
                            <button
                              type="button"
                              className="text-indigo-600 transition hover:text-indigo-800"
                              onClick={() => openEdit(quiz)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-red-600 transition hover:text-red-800"
                              onClick={() => setDeleting(quiz)}
                            >
                              Delete
                            </button>
                            {quiz.status !== 'PUBLISHED' && (
                              <button
                                type="button"
                                className="text-emerald-600 transition hover:text-emerald-800 disabled:opacity-60"
                                disabled={busyId === quiz.id}
                                onClick={() => runAction(quiz.id, 'publish')}
                              >
                                Publish
                              </button>
                            )}
                            {quiz.status !== 'CLOSED' && (
                              <button
                                type="button"
                                className="text-red-600 transition hover:text-red-800 disabled:opacity-60"
                                disabled={busyId === quiz.id}
                                onClick={() => runAction(quiz.id, 'close')}
                              >
                                Close
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
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

      {creating && (
        <QuizFormModal
          assignments={assignments}
          onClose={() => setCreating(false)}
          onSaved={reload}
        />
      )}
      {editing && (
        <QuizFormModal
          quiz={editing.quiz}
          classIds={editing.classIds}
          assignments={assignments}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete quiz"
          message={`Delete "${deleting.title}"? Quizzes with student attempts cannot be deleted.`}
          confirmLabel="Delete quiz"
          onConfirm={async () => {
            await api.deleteQuiz(deleting.id)
            reload()
          }}
          onClose={() => setDeleting(null)}
        />
      )}
      {managingQuestions && (
        <QuizQuestionsModal quiz={managingQuestions} onClose={() => setManagingQuestions(null)} />
      )}
      {viewingStats && <QuizStatsModal quiz={viewingStats} onClose={() => setViewingStats(null)} />}
    </>
  )
}
