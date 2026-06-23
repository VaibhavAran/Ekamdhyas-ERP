import {
  FiRefreshCw,
  FiUser,
  FiUsers,
} from 'react-icons/fi';

interface StudentStats {
  total: number;
  active: number;
  promoted: number;
  byBoard: [string, number][];
  byClass: [string, number][];
  byYear: [string, number][];
}

export function StudentStatsPanel({ stats }: { stats: StudentStats }) {
  const cards = [
    {
      label: 'Total Students',
      value: stats.total,
      Icon: FiUsers,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      ring: 'ring-blue-100',
      gradient: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Active Students',
      value: stats.active,
      Icon: FiUser,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      ring: 'ring-emerald-100',
      gradient: 'from-emerald-500 to-emerald-600',
    },
    {
      label: 'Promoted Students',
      value: stats.promoted,
      Icon: FiRefreshCw,
      color: 'text-violet-600',
      bg: 'bg-violet-50',
      ring: 'ring-violet-100',
      gradient: 'from-violet-500 to-violet-600',
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-3">
      {cards.map(({ label, value, Icon, color, bg, ring, gradient }) => (
        <div
          key={label}
          className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-lg transition-all duration-300"
        >
          <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${gradient} opacity-[0.07] group-hover:scale-150 transition-transform duration-500`} />
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className="mt-2 text-4xl font-black text-slate-900 tracking-tight">{value}</p>
            </div>
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${bg} ring-1 ${ring}`}>
              <Icon className={`text-xl ${color}`} />
            </div>
          </div>
          <div className="mt-4 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
              style={{ width: `${stats.total > 0 ? Math.round((value / stats.total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {stats.total > 0 ? Math.round((value / stats.total) * 100) : 0}% of total
          </p>
        </div>
      ))}
    </div>
  );
}
