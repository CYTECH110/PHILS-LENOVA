import { useState } from 'react'
import { api } from '../../lib/api.js'
import { usePagedList } from '../../lib/usePagedList.js'
import Panel from '../../components/Panel.jsx'
import Modal from '../../components/Modal.jsx'
import Field, { buttonPrimary, buttonSecondary, inputClass } from '../../components/Field.jsx'
import Pagination from '../../components/Pagination.jsx'

const EMPTY_FORM = { name: '', code: '', latitude: '', longitude: '', radius_meters: '100' }

function formFromClass(classItem) {
  if (!classItem) return { ...EMPTY_FORM }
  return {
    name: classItem.name || '',
    code: classItem.code || '',
    latitude: classItem.latitude ?? '',
    longitude: classItem.longitude ?? '',
    radius_meters: String(classItem.radius_meters ?? 100),
  }
}

function ClassFormModal({ classItem, onClose, onSaved }) {
  const editing = Boolean(classItem)
  const [form, setForm] = useState(() => formFromClass(classItem))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [locating, setLocating] = useState(false)

  const update = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }))

  function handleUseLocation() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(7),
          longitude: position.coords.longitude.toFixed(7),
        }))
        setLocating(false)
      },
      (err) => {
        setError(err.message || 'Could not read your location.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSaving(true)
    try {
      const latitude = form.latitude === '' ? null : Number(form.latitude)
      const longitude = form.longitude === '' ? null : Number(form.longitude)
      if ((latitude === null) !== (longitude === null)) {
        throw new Error('Provide both latitude and longitude, or neither.')
      }
      if (latitude !== null && !Number.isFinite(latitude)) {
        throw new Error('Latitude must be a number.')
      }
      if (longitude !== null && !Number.isFinite(longitude)) {
        throw new Error('Longitude must be a number.')
      }
      const fields = {
        name: form.name,
        code: form.code,
        latitude,
        longitude,
        radius_meters: Number(form.radius_meters) || 100,
      }
      if (editing) {
        await api.updateClass(classItem.id, fields)
      } else {
        await api.createClass(fields)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <Modal title={editing ? 'Edit class' : 'Create class'} onClose={onClose}>
      <form className="space-y-4" onSubmit={handleSubmit}>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <Field label="Class name" htmlFor="class-name">
          <input
            id="class-name"
            className={inputClass}
            value={form.name}
            onChange={update('name')}
            required
            maxLength={120}
          />
        </Field>

        <Field label="Class code" htmlFor="class-code" hint="Must be unique. Students use it to identify the class.">
          <input
            id="class-code"
            className={inputClass}
            value={form.code}
            onChange={update('code')}
            required
            maxLength={40}
            autoComplete="off"
          />
        </Field>

        <fieldset className="rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Geofence (optional)</legend>
          <p className="mb-2 text-xs text-slate-500">
            Quizzes scheduled for this class will require students to be inside the radius below.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="class-lat">
              <input
                id="class-lat"
                className={inputClass}
                value={form.latitude}
                onChange={update('latitude')}
                inputMode="decimal"
                placeholder="14.5995123"
              />
            </Field>
            <Field label="Longitude" htmlFor="class-lng">
              <input
                id="class-lng"
                className={inputClass}
                value={form.longitude}
                onChange={update('longitude')}
                inputMode="decimal"
                placeholder="120.9842215"
              />
            </Field>
          </div>
          <div className="mt-3 grid grid-cols-2 items-end gap-3">
            <Field label="Radius (meters)" htmlFor="class-radius">
              <input
                id="class-radius"
                className={inputClass}
                value={form.radius_meters}
                onChange={update('radius_meters')}
                type="number"
                min={1}
                max={10000}
              />
            </Field>
            <button
              type="button"
              className={`${buttonSecondary} mb-1`}
              onClick={handleUseLocation}
              disabled={locating}
            >
              {locating ? 'Locating…' : 'Use my location'}
            </button>
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className={buttonPrimary} disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create class'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function ClassesPanel() {
  const { page, setPage, rows, loading, error, limit, reload } = usePagedList(
    api.getClasses,
    'classes'
  )
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState('')

  async function openEdit(row) {
    setActionError('')
    try {
      const detail = await api.getClass(row.id)
      setEditing(detail.class || row)
    } catch (err) {
      setActionError(err.message)
    }
  }

  return (
    <>
      <Panel
        title="Classes"
        action={
          <button type="button" className={buttonPrimary} onClick={() => setCreating(true)}>
            + New class
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
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">ID</th>
                  <th className="px-4 py-2 font-medium">Name</th>
                  <th className="px-4 py-2 font-medium">Code</th>
                  <th className="px-4 py-2 font-medium">Latitude</th>
                  <th className="px-4 py-2 font-medium">Longitude</th>
                  <th className="px-4 py-2 font-medium">Radius (m)</th>
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
                      No classes found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((item) => (
                    <tr key={item.id} className="border-t border-slate-100">
                      <td className="px-4 py-2 text-slate-500">{item.id}</td>
                      <td className="px-4 py-2 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-2 text-slate-600">{item.code}</td>
                      <td className="px-4 py-2 text-slate-600">{item.latitude ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{item.longitude ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-600">{item.radius_meters}</td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          className="text-indigo-600 transition hover:text-indigo-800"
                          onClick={() => openEdit(item)}
                        >
                          Edit
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

      {creating && <ClassFormModal onClose={() => setCreating(false)} onSaved={reload} />}
      {editing && (
        <ClassFormModal
          classItem={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </>
  )
}
