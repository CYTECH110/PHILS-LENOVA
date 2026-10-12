import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

function CourseFormModal({ initial, onClose, onSaved }) {
  const isEdit = Boolean(initial.id)
  const [form, setForm] = useState({
    name: initial.name || '',
    description: initial.description || '',
    status: initial.status || 'ACTIVE',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        status: form.status,
      }
      if (isEdit) await api.updateCourse(initial.id, payload)
      else await api.createCourse({ name: payload.name, description: payload.description })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={isEdit ? `Edit course #${initial.id}` : 'Create course'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <Field label="Name" htmlFor="course-name">
          <input
            id="course-name"
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            required
            maxLength={160}
          />
        </Field>

        <Field label="Description" htmlFor="course-description">
          <textarea
            id="course-description"
            className={inputClass}
            rows={3}
            value={form.description}
            onChange={update('description')}
          />
        </Field>

        {isEdit && (
          <Field label="Status" htmlFor="course-status" hint="Inactive courses are hidden from dashboards.">
            <select
              id="course-status"
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
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create course'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function CoursesPanel() {
  const { page, setPage, rows, loading, error, limit, reload } = usePagedList(
    api.getAdminCourses,
    'courses'
  )
  const [editing, setEditing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [toggling, setToggling] = useState(null)
  const [actionError, setActionError] = useState('')

  async function toggleStatus(course) {
    setToggling(course.id)
    setActionError('')
    try {
      await api.updateCourse(course.id, {
        name: course.name,
        description: course.description,
        status: course.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      })
      reload()
    } catch (err) {
      setActionError(err.message)
    } finally {
      setToggling(null)
    }
  }

  return (
    <>
      <Panel
        title="Courses"
        action={
          <button type="button" className={buttonPrimary} onClick={() => setEditing({})}>
            + New course
          </button>
        }
      >
        {actionError && (
          <p className="px-4 pt-3 text-sm text-red-600" role="alert">
            {actionError}
          </p>
        )}
        {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}
        {!error && (
          <>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Description</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 text-right font-medium">Actions</th>
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
                      No courses found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((course) => (
                    <tr key={course.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{course.id}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{course.name}</td>
                      <td className="max-w-xs truncate px-4 py-2 text-slate-600">
                        {course.description || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={
                            course.status === 'INACTIVE'
                              ? 'rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700'
                              : 'rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700'
                          }
                        >
                          {course.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            className="text-indigo-600 transition hover:text-indigo-800 disabled:opacity-50"
                            onClick={() => setEditing(course)}
                            disabled={toggling === course.id}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-amber-600 transition hover:text-amber-800 disabled:opacity-50"
                            onClick={() => toggleStatus(course)}
                            disabled={toggling === course.id}
                          >
                            {toggling === course.id
                              ? 'Saving…'
                              : course.status === 'ACTIVE'
                                ? 'Deactivate'
                                : 'Activate'}
                          </button>
                          <button
                            type="button"
                            className="text-red-600 transition hover:text-red-800"
                            onClick={() => setDeleting(course)}
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
        <CourseFormModal initial={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}

      {deleting && (
        <ConfirmDialog
          title="Deactivate course"
          message={`"${deleting.name}" (#${deleting.id}) will be marked INACTIVE and hidden from dashboards. Existing data is kept.`}
          confirmLabel="Deactivate"
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await api.deleteCourse(deleting.id)
            reload()
          }}
        />
      )}
    </>
  )
}
