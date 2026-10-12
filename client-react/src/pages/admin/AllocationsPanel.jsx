import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { fetchAdminOptions } from '../../lib/fetchOptions.js'
import Panel from '../../components/Panel.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Field, { buttonPrimary, inputClass } from '../../components/Field.jsx'

function AllocationForm({ title, description, sourceLabel, sourcePlaceholder, sourceOptions, targetLabel, targetPlaceholder, targetOptions, onSubmit, onAssigned }) {
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null)
  const fieldId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  async function handleSubmit(event) {
    event.preventDefault()
    setMessage(null)
    if (!sourceId || !targetId) {
      setMessage({ kind: 'error', text: 'Pick both options before assigning.' })
      return
    }
    setBusy(true)
    try {
      await onSubmit(Number(sourceId), Number(targetId))
      setMessage({ kind: 'success', text: 'Assigned successfully.' })
      setSourceId('')
      setTargetId('')
      onAssigned()
    } catch (err) {
      setMessage({ kind: 'error', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
      onSubmit={handleSubmit}
    >
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>

      {message && (
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
      )}

      <Field label={sourceLabel} htmlFor={`${fieldId}-source`}>
        <select
          id={`${fieldId}-source`}
          className={inputClass}
          value={sourceId}
          onChange={(event) => setSourceId(event.target.value)}
        >
          <option value="">{sourcePlaceholder}</option>
          {sourceOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <Field label={targetLabel} htmlFor={`${fieldId}-target`}>
        <select
          id={`${fieldId}-target`}
          className={inputClass}
          value={targetId}
          onChange={(event) => setTargetId(event.target.value)}
        >
          <option value="">{targetPlaceholder}</option>
          {targetOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      <button type="submit" className={buttonPrimary} disabled={busy}>
        {busy ? 'Assigning…' : 'Assign'}
      </button>
    </form>
  )
}

function AllocationTable({ title, rows, columns, onRemove }) {
  return (
    <section>
      <h3 className="mb-2 font-semibold text-slate-900">{title}</h3>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-3 py-2 font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-3 py-4 text-center text-slate-500">
                  No allocations yet.
                </td>
              </tr>
            )}
            {rows.map((row, index) => (
              <tr key={index} className="border-t border-slate-100">
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2 text-slate-700">
                    {row[column.key]}
                  </td>
                ))}
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    className="text-red-600 transition hover:text-red-800"
                    onClick={() => onRemove(row)}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function AllocationsPanel() {
  const [options, setOptions] = useState(null)
  const [error, setError] = useState('')
  const [allocations, setAllocations] = useState(null)
  const [listError, setListError] = useState('')
  const [pendingRemoval, setPendingRemoval] = useState(null)

  const loadAllocations = useCallback(() => {
    api
      .getAllocations()
      .then((data) => {
        setAllocations(data)
        setListError('')
      })
      .catch((err) => setListError(err.message))
  }, [])

  useEffect(() => {
    let active = true
    fetchAdminOptions()
      .then((data) => {
        if (active) setOptions(data)
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    loadAllocations()
  }, [loadAllocations])

  const label = (prefix) => (row) => `${prefix} #${row.id} — ${row.full_name || row.name}`
  const students = (options?.students || []).map((row) => ({ id: row.id, label: label('Student')(row) }))
  const teachers = (options?.teachers || []).map((row) => ({ id: row.id, label: label('Teacher')(row) }))
  const classes = (options?.classes || []).map((row) => ({ id: row.id, label: `Class #${row.id} — ${row.name} (${row.code})` }))
  const courses = (options?.courses || []).map((row) => ({ id: row.id, label: `Course #${row.id} — ${row.name}` }))

  const studentClasses = allocations?.studentClasses || []
  const teacherClasses = allocations?.teacherClasses || []
  const teacherCourses = allocations?.teacherCourses || []

  return (
    <Panel title="Allocations">
      <div className="space-y-6 p-4">
        <p className="text-sm text-slate-500">
          Allocate students to classes, teachers to classes, and teachers to courses. Duplicate
          assignments are rejected by the database.
        </p>

        {error && (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {!options && !error && <p className="text-sm text-slate-500">Loading options…</p>}

        {options && (
          <div className="grid gap-4 lg:grid-cols-3">
            <AllocationForm
              title="Student → Class"
              description="Enrol a student into a class so its quizzes become visible to them."
              sourceLabel="Student"
              sourcePlaceholder="Select a student"
              sourceOptions={students}
              targetLabel="Class"
              targetPlaceholder="Select a class"
              targetOptions={classes}
              onSubmit={(studentId, classId) => api.assignStudent(studentId, classId)}
              onAssigned={loadAllocations}
            />
            <AllocationForm
              title="Teacher → Class"
              description="Give a teacher access to a class and its rosters."
              sourceLabel="Teacher"
              sourcePlaceholder="Select a teacher"
              sourceOptions={teachers}
              targetLabel="Class"
              targetPlaceholder="Select a class"
              targetOptions={classes}
              onSubmit={(teacherId, classId) => api.assignTeacher(teacherId, classId)}
              onAssigned={loadAllocations}
            />
            <AllocationForm
              title="Teacher → Course"
              description="Allow a teacher to create quizzes under a course."
              sourceLabel="Teacher"
              sourcePlaceholder="Select a teacher"
              sourceOptions={teachers}
              targetLabel="Course"
              targetPlaceholder="Select a course"
              targetOptions={courses}
              onSubmit={(teacherId, courseId) => api.assignCourse(teacherId, courseId)}
              onAssigned={loadAllocations}
            />
          </div>
        )}

        {options && (students.length === 0 || teachers.length === 0 || classes.length === 0 || courses.length === 0) && (
          <p className="text-xs text-amber-700">
            One or more dropdowns are empty — create the missing users, classes, or courses first.
          </p>
        )}

        <div className="border-t border-slate-200 pt-6">
          <h2 className="mb-3 font-semibold text-slate-900">Current allocations</h2>
          {listError && (
            <p role="alert" className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {listError}
            </p>
          )}
          {!allocations && !listError && <p className="text-sm text-slate-500">Loading allocations…</p>}
          {allocations && (
            <div className="space-y-6">
              <AllocationTable
                title="Students → Classes"
                rows={studentClasses}
                columns={[
                  { key: 'student_name', label: 'Student' },
                  { key: 'class_name', label: 'Class' },
                  { key: 'class_code', label: 'Code' },
                ]}
                onRemove={(row) =>
                  setPendingRemoval({
                    title: 'Remove student from class',
                    message: `Remove ${row.student_name} from ${row.class_name} (${row.class_code})?`,
                    run: () => api.unassignStudent(row.student_id, row.class_id),
                  })
                }
              />
              <AllocationTable
                title="Teachers → Classes"
                rows={teacherClasses}
                columns={[
                  { key: 'teacher_name', label: 'Teacher' },
                  { key: 'class_name', label: 'Class' },
                  { key: 'class_code', label: 'Code' },
                ]}
                onRemove={(row) =>
                  setPendingRemoval({
                    title: 'Remove teacher from class',
                    message: `Remove ${row.teacher_name} from ${row.class_name} (${row.class_code})?`,
                    run: () => api.unassignTeacher(row.teacher_id, row.class_id),
                  })
                }
              />
              <AllocationTable
                title="Teachers → Courses"
                rows={teacherCourses}
                columns={[
                  { key: 'teacher_name', label: 'Teacher' },
                  { key: 'course_name', label: 'Course' },
                ]}
                onRemove={(row) =>
                  setPendingRemoval({
                    title: 'Remove teacher from course',
                    message: `Remove ${row.teacher_name} from ${row.course_name}?`,
                    run: () => api.unassignCourse(row.teacher_id, row.course_id),
                  })
                }
              />
            </div>
          )}
        </div>
      </div>

      {pendingRemoval && (
        <ConfirmDialog
          title={pendingRemoval.title}
          message={pendingRemoval.message}
          confirmLabel="Remove"
          onConfirm={async () => {
            await pendingRemoval.run()
            loadAllocations()
          }}
          onClose={() => setPendingRemoval(null)}
        />
      )}
    </Panel>
  )
}
