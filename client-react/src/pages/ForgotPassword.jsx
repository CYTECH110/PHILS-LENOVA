import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import Field, { buttonPrimary, inputClass } from '../components/Field.jsx'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    try {
      const data = await api.forgotPassword(email)
      setMessage(data.message || 'If an account exists for that email, a reset link has been sent.')
      setEmail('')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-semibold text-slate-900">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter the email on your account and we&apos;ll send a reset link.
        </p>

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

          <Field label="Email" htmlFor="forgot-email">
            <input
              id="forgot-email"
              type="email"
              className={inputClass}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </Field>

          <button type="submit" className={`w-full ${buttonPrimary}`} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send reset link'}
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
