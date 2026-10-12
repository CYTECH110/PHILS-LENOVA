export default function Panel({ title, action, children }) {
  return (
    <section className="overflow-hidden rounded-xl bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold text-slate-900">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}
