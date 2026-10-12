import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api.js'
import { buttonPrimary, buttonSecondary } from '../../components/Field.jsx'

function formatRemaining(totalSeconds) {
  const seconds = Math.max(0, totalSeconds)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

function QuestionInput({ question, value, onChange }) {
  if (question.question_type === 'MULTIPLE_CHOICE' && Array.isArray(question.options) && question.options.length > 0) {
    return (
      <div className="space-y-2">
        {question.options.map((option, index) => (
          <label
            key={`${question.id}-${index}`}
            className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <input
              type="radio"
              name={`question-${question.id}`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="mt-0.5"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    )
  }

  if (question.question_type === 'TRUE_FALSE') {
    return (
      <div className="flex gap-2">
        {['TRUE', 'FALSE'].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={
              value === option
                ? 'rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white'
                : 'rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50'
            }
          >
            {option === 'TRUE' ? 'True' : 'False'}
          </button>
        ))}
      </div>
    )
  }

  return (
    <input
      type="text"
      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder="Your answer"
      autoComplete="off"
    />
  )
}

export default function QuizRunner({ session, locationStatus, onExit, onFinished }) {
  const { attempt, quiz, questions } = session
  const [answers, setAnswers] = useState({})
  const answersRef = useRef({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const submittedRef = useRef(false)

  function setAnswer(questionId, value) {
    answersRef.current = { ...answersRef.current, [questionId]: value }
    setAnswers(answersRef.current)
  }

  const durationSeconds = Number(quiz.duration_minutes) > 0 ? Number(quiz.duration_minutes) * 60 : null
  const deadline = useMemo(() => {
    const started = new Date(String(attempt.started_at).replace(' ', 'T')).getTime()
    return Number.isFinite(started) && durationSeconds ? started + durationSeconds * 1000 : null
  }, [attempt.started_at, durationSeconds])
  const [remaining, setRemaining] = useState(() => (deadline ? Math.floor((deadline - Date.now()) / 1000) : null))

  const answeredCount = questions.filter((q) => String(answers[q.id] ?? '').trim() !== '').length

  async function doSubmit() {
    if (submittedRef.current) return
    submittedRef.current = true
    setSubmitting(true)
    setError('')
    try {
      const payload = questions.map((question) => ({
        question_id: question.id,
        answer: typeof answersRef.current[question.id] === 'string' ? answersRef.current[question.id] : '',
      }))
      const data = await api.submitQuiz(attempt.id, payload)
      setResult(data)
      onFinished?.()
    } catch (err) {
      submittedRef.current = false
      setSubmitting(false)
      setError(err.message)
    }
  }

  const doSubmitRef = useRef(null)

  useEffect(() => {
    doSubmitRef.current = doSubmit
  })

  useEffect(() => {
    if (!deadline || result) return undefined
    const timer = setInterval(() => {
      const left = Math.floor((deadline - Date.now()) / 1000)
      setRemaining(left)
      if (left <= 0) {
        clearInterval(timer)
        setError("Time is up — submitting your answers…")
        doSubmitRef.current?.()
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline, result])

  function handleExit() {
    if (result) {
      onExit()
      return
    }
    if (window.confirm('Leave the quiz? Your answers will NOT be submitted.')) onExit()
  }

  if (result) {
    const total = result.total ?? questions.length
    return (
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <section className="rounded-xl bg-white p-8 text-center shadow-sm">
          <p className="text-sm uppercase tracking-wide text-slate-500">Result</p>
          <p className="mt-3 text-5xl font-semibold text-slate-900">
            {result.score}
            <span className="text-2xl text-slate-400"> / {total}</span>
          </p>
          <p
            className={
              result.passed
                ? 'mt-3 inline-block rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700'
                : 'mt-3 inline-block rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700'
            }
          >
            {result.passed ? 'Passed' : 'Not passed'}
          </p>
          <p className="mt-4 text-sm text-slate-500">{quiz.title}</p>
        </section>
        <div className="flex justify-center">
          <button type="button" className={buttonPrimary} onClick={handleExit}>
            Back to quizzes
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
        <div>
          <h2 className="font-semibold text-slate-900">{quiz.title}</h2>
          <p className="text-xs text-slate-500">
            {answeredCount} of {questions.length} answered
            {locationStatus === 'verified' && ' · location verified'}
            {locationStatus === 'unavailable' && ' · location unavailable'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {remaining !== null && (
            <span
              className={
                remaining <= 30
                  ? 'font-mono text-lg font-semibold text-red-600'
                  : 'font-mono text-lg font-semibold text-slate-700'
              }
              aria-live="polite"
            >
              {formatRemaining(remaining)}
            </span>
          )}
          <button type="button" className={buttonSecondary} onClick={handleExit} disabled={submitting}>
            Exit
          </button>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      {questions.length === 0 && (
        <p className="rounded-xl bg-white px-4 py-6 text-sm text-slate-500 shadow-sm">
          This quiz has no questions.
        </p>
      )}

      {questions.map((question, index) => (
        <section key={question.id} className="rounded-xl bg-white p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">
            {index + 1}. {question.question_text}
          </h3>
          {question.image_path && (
            <img
              src={question.image_path}
              alt=""
              className="mt-3 max-h-64 rounded-md border border-slate-200 object-contain"
            />
          )}
          <div className="mt-3">
            <QuestionInput
              question={question}
              value={answers[question.id] ?? ''}
              onChange={(value) => setAnswer(question.id, value)}
            />
          </div>
        </section>
      ))}

      {questions.length > 0 && (
        <div className="flex justify-end">
          <button type="button" className={buttonPrimary} onClick={doSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit quiz'}
          </button>
        </div>
      )}
    </div>
  )
}
