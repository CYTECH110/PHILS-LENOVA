import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import Field, { buttonPrimary, inputClass } from '../components/Field.jsx'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (next.length < 8) {
      setError('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.')
      return
    }
    setSubmitting(true)
    try {
      const data = await api.resetPassword(token, next)
      setMessage(data.message || 'Password has been reset. You can now sign in.')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-500">Enter and confirm your new password.</p>

        {!token && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            This reset link is missing its token. Request a new link from the forgot password page.
          </p>
        )}

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
            >
              {message}
            </p>
          )}

          <Field label="New password" htmlFor="reset-new" hint="At least 8 characters.">
            <input
              id="reset-new"
              type="password"
              className={inputClass}
              value={next}
              onChange={(event) => setNext(event.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Confirm new password" htmlFor="reset-confirm">
            <input
              id="reset-confirm"
              type="password"
              className={inputClass}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
              minLength={8}
              maxLength={200}
              autoComplete="new-password"
            />
          </Field>

          <button
            type="submit"
            className={`w-full ${buttonPrimary}`}
            disabled={submitting || !token}
          >
            {submitting ? 'Resetting…' : 'Reset password'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
