'use client'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  downloaded: number
  missing: number
  unmonitored: number
}

const COLORS = ['#22c55e', '#f59e0b', '#475569']

export function LibraryDonut({ downloaded, missing, unmonitored }: Props) {
  const total = downloaded + missing + unmonitored
  const data = [
    { name: 'Scaricati', value: downloaded },
    { name: 'Mancanti', value: missing },
    { name: 'Non monitorati', value: unmonitored },
  ]

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Stato Libreria
      </h3>
      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={32}
                outerRadius={48}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{total}</span>
            <span className="text-[10px] text-slate-500">Totale</span>
          </div>
        </div>
        <div className="text-xs space-y-2 w-full">
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-slate-400">{d.name}</span>
              </span>
              <span className="font-semibold text-slate-300 tabular-nums">{d.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
