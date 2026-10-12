import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

const EMPTY_FORM = { username: '', full_name: '', role: 'STUDENT', password: '', status: 'ACTIVE' }

function UserFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial.id)
  const [form, setForm] = useState(
    isEdit
      ? {
          username: initial.username,
          full_name: initial.full_name || '',
          role: initial.role || 'STUDENT',
          password: '',
          status: initial.status || 'ACTIVE',
        }
      : { ...EMPTY_FORM }
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      if (isEdit) {
        await api.updateUser(initial.id, {
          full_name: form.full_name,
          role: form.role,
          status: form.status,
        })
      } else {
        await api.createUser({
          username: form.username,
          full_name: form.full_name,
          role: form.role,
          password: form.password,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit user #${initial.id}` : 'Create user'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <Field label="Username" htmlFor="user-username">
          <input
            id="user-username"
            className={inputClass}
            value={form.username}
            onChange={update('username')}
            disabled={isEdit}
            required
            maxLength={80}
            autoComplete="off"
          />
        </Field>

        <Field label="Full name" htmlFor="user-full-name">
          <input
            id="user-full-name"
            className={inputClass}
            value={form.full_name}
            onChange={update('full_name')}
            required
            maxLength={160}
          />
        </Field>

        <Field label="Role" htmlFor="user-role">
          <select id="user-role" className={inputClass} value={form.role} onChange={update('role')}>
            <option value="STUDENT">Student</option>
            <option value="TEACHER">Teacher</option>
          </select>
        </Field>

        {!isEdit && (
          <Field
            label="Password"
            htmlFor="user-password"
            hint="At least 12 characters. Share it with the user; they can change it later."
          >
            <input
              id="user-password"
              type="password"
              className={inputClass}
              value={form.password}
              onChange={update('password')}
              required
              minLength={12}
              maxLength={200}
              autoComplete="new-password"
            />
          </Field>
        )}

        {isEdit && (
          <Field
            label="Status"
            htmlFor="user-status"
            hint="Inactive users cannot sign in."
          >
            <select
              id="user-status"
              className={inputClass}
              value={form.status}
              onChange={update('status')}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={buttonPrimary} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create user'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function UsersPanel() {
  const { page, setPage, rows, loading, error, limit, reload } = usePagedList(api.getUsers, 'users')
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)

  return (
    <>
      <Panel
        title="Users"
        action={
          <button type="button" className={buttonPrimary} onClick={() => setEditing({})}>
            + New user
          </button>
        }
      >
        {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
        {!error && (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Username</th>
                  <th className="px-4 py-2 font-medium">Full name</th>
                  <th className="px-4 py-2 font-medium">Role</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
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
                      No users found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((user) => (
                    <tr key={user.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{user.id}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{user.username}</td>
                      <td className="px-4 py-2 text-slate-600">{user.full_name}</td>
                      <td className="px-4 py-2 text-slate-600">{user.role}</td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            user.status === 'INACTIVE'
                              ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                              : 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          }
                        >
                          {user.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            className="text-indigo-600 transition hover:text-indigo-800"
                            onClick={() => setEditing(user)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-red-600 transition hover:text-red-800"
                            onClick={() => setDeleting(user)}
                          >
                            Delete
                          </button>
                        </div>
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

      {editing && (
        <UserFormModal initial={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete user"
          message={`Permanently delete "${deleting.username}" (#${deleting.id})? This cannot be undone and fails if the user has audit history.`}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteUser(deleting.id)
            reload()
          }}
        />
      )}
    </>
  )
}
