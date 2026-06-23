export function InfoGrid({ title, rows }: { title: string; rows: [string, string | undefined][] }) {
  return (
    <div>
      <h3 className="mb-3 text-lg font-bold text-slate-900">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-100 bg-white p-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 font-semibold text-slate-800 truncate">{value || '-'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
