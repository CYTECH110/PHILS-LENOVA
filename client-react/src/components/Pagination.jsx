export default function Pagination({ page, limit, rowCount, onPageChange, disabled }) {
  const hasNext = rowCount === limit
  const hasPrev = page > 1

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-sm">
      <span className="text-slate-500">Page {page}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || disabled}
          className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || disabled}
          className="rounded-md border border-slate-300 px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  )
}