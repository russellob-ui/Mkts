interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  accent?: boolean
  positive?: boolean
  negative?: boolean
}

export default function StatCard({ label, value, sub, accent, positive, negative }: StatCardProps) {
  const valueClass = positive
    ? 'text-green-400'
    : negative
    ? 'text-red-400'
    : accent
    ? 'text-blue-400'
    : 'text-slate-100'

  return (
    <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 shadow-card">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">{label}</p>
      <p className={`text-base font-semibold leading-tight ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}
