import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

const TYPE_LABELS = {
  MULTIPLE_CHOICE: 'Multiple choice',
  TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer',
  FILL_BLANK: 'Fill in the blank',
}

const DIFFICULTY_CLASS = {
  EASY: 'bg-emerald-50 text-emerald-700',
  MEDIUM: 'bg-amber-50 text-amber-700',
  HARD: 'bg-red-50 text-red-700',
}

function parseAnswerData(raw) {
  try {
    return typeof raw === 'string' ? JSON.parse(raw || '{}') : raw || {}
  } catch {
    return {}
  }
}

function answerPreview(question) {
  const data = parseAnswerData(question.answer_data)
  if (question.question_type === 'MULTIPLE_CHOICE') {
    const count = Array.isArray(data.options) ? data.options.length : 0
    return data.correct_answer ? `${count} options · answer: ${data.correct_answer}` : `${count} options`
  }
  return data.correct_answer ? `answer: ${data.correct_answer}` : '—'
}

function QuestionFormModal({ question, onClose, onSaved }) {
  const editing = Boolean(question)
  const parsed = question ? parseAnswerData(question.answer_data) : {}
  const initialOptions =
    question?.question_type === 'MULTIPLE_CHOICE' && Array.isArray(parsed.options) && parsed.options.length
      ? parsed.options
      : ['', '', '', '']

  const [questionType, setQuestionType] = useState(question?.question_type || 'MULTIPLE_CHOICE')
  const [questionText, setQuestionText] = useState(question?.question_text || '')
  const [difficulty, setDifficulty] = useState(question?.difficulty || 'MEDIUM')
  const [options, setOptions] = useState(initialOptions)
  const [correctIndex, setCorrectIndex] = useState(() => {
    if (question?.question_type === 'MULTIPLE_CHOICE' && parsed.correct_answer) {
      const idx = initialOptions.indexOf(parsed.correct_answer)
      return idx >= 0 ? idx : 0
    }
    return 0
  })
  const [tfAnswer, setTfAnswer] = useState(
    question?.question_type === 'TRUE_FALSE' && parsed.correct_answer ? parsed.correct_answer : 'TRUE'
  )
  const [shortAnswer, setShortAnswer] = useState(
    question && (question.question_type === 'SHORT_ANSWER' || question.question_type === 'FILL_BLANK')
      ? parsed.correct_answer || ''
      : ''
  )
  const [imageFile, setImageFile] = useState(null)
  const [removeImage, setRemoveImage] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const updateOption = (index) => (event) =>
    setOptions((current) => current.map((value, i) => (i === index ? event.target.value : value)))

  function buildAnswerData() {
    if (questionType === 'MULTIPLE_CHOICE') {
      const trimmed = options.map((value) => value.trim())
      const filled = trimmed.filter(Boolean)
      if (filled.length < 2) throw new Error('Provide at least two non-empty options.')
      const correct = trimmed[correctIndex]
      if (!correct) throw new Error('Select a correct option that is filled in.')
      return { options: filled, correct_answer: correct }
    }
    if (questionType === 'TRUE_FALSE') {
      return { correct_answer: tfAnswer }
    }
    const expected = shortAnswer.trim()
    if (!expected) throw new Error('Provide the expected answer.')
    return { correct_answer: expected }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    if (!questionText.trim()) {
      setError('Question text is required.')
      return
    }
    let answerData
    try {
      answerData = buildAnswerData()
    } catch (err) {
      setError(err.message)
      return
    }
    setSaving(true)
    try {
      const fields = {
        question_type: questionType,
        question_text: questionText.trim(),
        answer_data: answerData,
        difficulty,
      }
      if (editing) {
        await api.updateQuestion(question.id, { ...fields, clear_image: removeImage }, imageFile)
      } else {
        await api.createQuestion(fields, imageFile)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit question' : 'Create question'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <Field label="Question type" htmlFor="question-type">
          <select
            id="question-type"
            className={inputClass}
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value)}
          >
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Question text" htmlFor="question-text">
          <textarea
            id="question-text"
            className={`${inputClass} min-h-20`}
            value={questionText}
            onChange={(event) => setQuestionText(event.target.value)}
            maxLength={5000}
            required
          />
        </Field>

        {questionType === 'MULTIPLE_CHOICE' && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">
              Options — pick the correct one
            </legend>
            {options.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct-option"
                  aria-label={`Mark option ${index + 1} correct`}
                  checked={correctIndex === index}
                  onChange={() => setCorrectIndex(index)}
                  className="mt-0.5"
                />
                <input
                  className={inputClass}
                  value={value}
                  placeholder={`Option ${index + 1}`}
                  onChange={updateOption(index)}
                  maxLength={500}
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove option ${index + 1}`}
                    className="rounded-md px-2 py-1 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-red-600"
                    onClick={() => {
                      setOptions((current) => current.filter((_, i) => i !== index))
                      setCorrectIndex((current) => (current === index ? 0 : current > index ? current - 1 : current))
                    }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className={buttonSecondary}
              onClick={() => setOptions((current) => [...current, ''])}
              disabled={options.length >= 8}
            >
              + Add option
            </button>
          </fieldset>
        )}

        {questionType === 'TRUE_FALSE' && (
          <Field label="Correct answer" htmlFor="tf-answer">
            <select
              id="tf-answer"
              className={inputClass}
              value={tfAnswer}
              onChange={(event) => setTfAnswer(event.target.value)}
            >
              <option value="TRUE">True</option>
              <option value="FALSE">False</option>
            </select>
          </Field>
        )}

        {(questionType === 'SHORT_ANSWER' || questionType === 'FILL_BLANK') && (
          <Field
            label="Expected answer"
            htmlFor="short-answer"
            hint="Matched case-insensitively when graded."
          >
            <input
              id="short-answer"
              className={inputClass}
              value={shortAnswer}
              onChange={(event) => setShortAnswer(event.target.value)}
              maxLength={500}
              required
            />
          </Field>
        )}

        <Field label="Difficulty" htmlFor="question-difficulty">
          <select
            id="question-difficulty"
            className={inputClass}
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value)}
          >
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </Field>

        {editing && question.image_path && !imageFile && (
          <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-600">
            <p className="mb-1">Current image: {question.image_path}</p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={removeImage}
                onChange={(event) => setRemoveImage(event.target.checked)}
              />
              Remove image when saving
            </label>
          </div>
        )}

        <Field
          label={editing ? 'Replace image (optional)' : 'Image (optional)'}
          htmlFor="question-image"
          hint="Shown to students above the question. Max 5 MB."
        >
          <input
            id="question-image"
            type="file"
            accept="image/*"
            className="mt-1 block w-full text-sm text-slate-600"
            onChange={(event) => {
              setImageFile(event.target.files?.[0] || null)
              setRemoveImage(false)
            }}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={buttonPrimary} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create question'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function QuestionBankPanel() {
  const { page, setPage, rows, loading, error, limit, reload } = usePagedList(
    api.getQuestionBank,
    'questions'
  )
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  return (
    <>
      <Panel
        title="Question bank"
        action={
          <button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
            + New question
          </button>
        }
      >
        {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
        {!error && (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">ID</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Question</th>
                    <th className="px-4 py-2 font-medium">Difficulty</th>
                    <th className="px-4 py-2 font-medium">Answer</th>
                    <th className="px-4 py-2 font-medium">Image</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                        No questions yet — create your first one.
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    rows.map((question) => (
                      <tr key={question.id} className="border-t border-slate-100 align-top">
                        <td className="px-4 py-2 text-slate-500">{question.id}</td>
                        <td className="px-4 py-2 text-slate-600">
                          {TYPE_LABELS[question.question_type] || question.question_type}
                        </td>
                        <td className="max-w-xs px-4 py-2 text-slate-800">
                          {question.question_text.length > 120
                            ? `${question.question_text.slice(0, 120)}…`
                            : question.question_text}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              DIFFICULTY_CLASS[question.difficulty] || 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {question.difficulty || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-600">{answerPreview(question)}</td>
                        <td className="px-4 py-2 text-slate-500">{question.image_path ? 'Yes' : '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <div className="inline-flex gap-3">
                            <button
                              type="button"
                              className="text-indigo-600 transition hover:text-indigo-800"
                              onClick={() => setEditing(question)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-red-600 transition hover:text-red-800"
                              onClick={() => setDeleting(question)}
                            >
                              Delete
                            </button>
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

      {creating && <QuestionFormModal onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && (
        <QuestionFormModal
          question={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete question"
          message={`Delete "${deleting.question_text.slice(0, 80)}"? This cannot be undone.`}
          confirmLabel="Delete question"
          onConfirm={async () => {
            await api.deleteQuestion(deleting.id)
            reload()
          }}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  )
}
