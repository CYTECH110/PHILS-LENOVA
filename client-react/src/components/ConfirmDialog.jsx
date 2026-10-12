import { useState } from 'react'
import Modal from './Modal.jsx'
import { buttonDanger, buttonSecondary } from './Field.jsx'

export default function ConfirmDialog({ title, message, confirmLabel = 'Delete', onConfirm, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleConfirm() {
    setBusy(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={busy ? () => {} : onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">{message}</p>
        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className={buttonSecondary} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={buttonDanger} onClick={handleConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
