import { useState } from 'react'
import { api } from '../lib/api.js'
import { useAuth } from '../context/useAuth.js'
import Panel from '../components/Panel.jsx'
import Field, { buttonPrimary, inputClass } from '../components/Field.jsx'

function Message({ message }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className={
        message.kind === 'success'
          ? 'rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
          : 'rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700'
      }
    >
      {message.text}
    </p>
  )
}

function AccountDetails() {
  const { user, updateUser } = useAuth()
  const [fullName, setFullName] = useState(user?.full_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage(null)
    setSaving(true)
    try {
      const data = await api.updateProfile({ full_name: fullName, email })
      updateUser(data.user)
      setFullName(data.user.full_name)
      setEmail(data.user.email || '')
      setMessage({ kind: 'success', text: 'Profile updated.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Account details">
      <form className="space-y-4 p-4" onSubmit={handleSubmit}>
        <Message message={message} />

        <Field label="Username" htmlFor="profile-username" hint="Usernames cannot be changed.">
          <input id="profile-username" className={inputClass} value={user?.username || ''} disabled />
        </Field>

        <Field label="Full name" htmlFor="profile-full-name">
          <input
            id="profile-full-name"
            className={inputClass}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
            maxLength={160}
          />
        </Field>

        <Field
          label="Email"
          htmlFor="profile-email"
          hint="Used for password resets. Leave blank to remove."
        >
          <input
            id="profile-email"
            type="email"
            className={inputClass}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={255}
            autoComplete="email"
          />
        </Field>

        <Field label="Role" htmlFor="profile-role">
          <input id="profile-role" className={inputClass} value={user?.role || ''} disabled />
        </Field>

        <button type="submit" className={buttonPrimary} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Panel>
  )
}

function ChangePassword() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage(null)
    if (next.length < 8) {
      setMessage({ kind: 'error', text: 'New password must be at least 8 characters.' })
      return
    }
    if (next !== confirm) {
      setMessage({ kind: 'error', text: 'New password and confirmation do not match.' })
      return
    }
    setSaving(true)
    try {
      await api.changePassword(current, next)
      setCurrent('')
      setNext('')
      setConfirm('')
      setMessage({ kind: 'success', text: 'Password updated.' })
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel title="Change password">
      <form className="space-y-4 p-4" onSubmit={handleSubmit}>
        <Message message={message} />

        <Field label="Current password" htmlFor="pw-current">
          <input
            id="pw-current"
            type="password"
            className={inputClass}
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            required
            autoComplete="current-password"
          />
        </Field>

        <Field label="New password" htmlFor="pw-new" hint="At least 8 characters.">
          <input
            id="pw-new"
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

        <Field label="Confirm new password" htmlFor="pw-confirm">
          <input
            id="pw-confirm"
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

        <button type="submit" className={buttonPrimary} disabled={saving}>
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </Panel>
  )
}

export default function ProfilePanel() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AccountDetails />
      <ChangePassword />
    </div>
  )
}
