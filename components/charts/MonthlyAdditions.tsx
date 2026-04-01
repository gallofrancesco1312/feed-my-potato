'use client'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface Props {
  data: { month: string; count: number }[]
}

export function MonthlyAdditions({ data }: Props) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Aggiunte Mensili
      </h3>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <XAxis
              dataKey="month"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'oklch(0.19 0.02 275)',
                border: '1px solid oklch(1 0 0 / 10%)',
                borderRadius: '12px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
              labelStyle={{ color: '#94a3b8' }}
              itemStyle={{ color: '#a78bfa' }}
              cursor={{ fill: 'oklch(1 0 0 / 3%)' }}
            />
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
            </defs>
            <Bar dataKey="count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} name="Aggiunti" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
