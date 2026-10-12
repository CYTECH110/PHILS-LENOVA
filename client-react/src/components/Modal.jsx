import { useEffect } from 'react'

export default function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-xl bg-white shadow-xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </header>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">{footer}</footer>
        )}
      </div>
    </div>
  )
}
