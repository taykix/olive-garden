'use client'

import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const PIE_COLORS = [
  '#2d6b28', '#4a8c3f', '#6aad57', '#8fc97a', '#b5e0a0',
  '#c5a55a', '#e8c97a', '#d97706', '#b45309', '#92400e',
  '#1d4ed8', '#7c3aed',
]

interface PieEntry { name: string; value: number }
interface BarEntry { month: string; Gelir: number; Gider: number }

function formatTL(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K ₺`
  return `${value} ₺`
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      {label && <p className="font-semibold text-gray-700 mb-1">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {p.value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
        </p>
      ))}
    </div>
  )
}

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { pct: string } }[] }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-700">{payload[0].name}</p>
      <p className="text-gray-600">
        {payload[0].value.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ₺
        <span className="ml-2 text-gray-400">({payload[0].payload.pct})</span>
      </p>
    </div>
  )
}

export function ExpensePieChart({ data }: { data: PieEntry[] }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const withPct = data.map(d => ({ ...d, pct: `${((d.value / total) * 100).toFixed(1)}%` }))

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={withPct}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={120}
          paddingAngle={2}
          dataKey="value"
          label={false}
          labelLine={false}
        >
          {withPct.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
        <Legend
          formatter={(value) => <span className="text-xs text-gray-600">{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export function MonthlyBarChart({ data }: { data: BarEntry[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 4, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatTL} tick={{ fontSize: 11 }} width={60} />
        <Tooltip content={<CustomTooltip />} />
        <Legend formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
        <Bar dataKey="Gelir" fill="#2d6b28" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Gider" fill="#dc2626" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
