'use client'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

interface Props {
  movieSize: number
  seriesSize: number
  freeSpace: number
  totalSpace: number
}

function formatSize(bytes: number): string {
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(0)} GB`
  return `${(bytes / 1e6).toFixed(0)} MB`
}

const colorMap: Record<string, string> = {
  Film: '#3b82f6',
  'Serie TV': '#8b5cf6',
  Occupato: '#f59e0b',
  Libero: '#1e293b',
}

export function DiskSpaceDonut({ movieSize, seriesSize, freeSpace, totalSpace }: Props) {
  const actualTotal = totalSpace > 0 ? totalSpace : movieSize + seriesSize + freeSpace
  const actualUsed = actualTotal - freeSpace
  const trackedUsed = movieSize + seriesSize
  const otherUsed = Math.max(0, actualUsed - trackedUsed)
  const usedPct = actualTotal > 0 ? Math.round((actualUsed / actualTotal) * 100) : 0

  const data = [
    ...(movieSize > 0 ? [{ name: 'Film', value: movieSize }] : []),
    ...(seriesSize > 0 ? [{ name: 'Serie TV', value: seriesSize }] : []),
    ...(otherUsed > 0 ? [{ name: 'Occupato', value: otherUsed }] : []),
    { name: 'Libero', value: freeSpace },
  ]

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
        Spazio Disco
      </h3>
      <div className="flex items-center gap-8">
        <div className="w-36 h-36 relative flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={colorMap[d.name] ?? '#475569'} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-white">{usedPct}%</span>
            <span className="text-[10px] text-slate-500">utilizzato</span>
          </div>
        </div>
        <div className="flex-1 space-y-3">
          {data.map((d) => (
            <div key={d.name} className="flex items-center gap-3">
              <span className="w-3 h-3 rounded-md" style={{ backgroundColor: colorMap[d.name] }} />
              <div className="flex-1">
                <span className="text-sm text-slate-300">{d.name}</span>
                <p className="text-xs text-slate-500">{formatSize(d.value)}</p>
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-white/[0.06]">
            <span className="text-xs text-slate-500">Totale: {formatSize(actualTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
