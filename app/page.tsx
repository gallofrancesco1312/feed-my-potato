'use client'
import { useEffect, useState } from 'react'
import { Film, Tv, Download, HardDrive, Activity, Calendar, ArrowDownToLine } from 'lucide-react'
import { LibraryDonut } from '@/components/charts/LibraryDonut'
import { DiskSpaceDonut } from '@/components/charts/DiskSpaceDonut'
import { MonthlyAdditions } from '@/components/charts/MonthlyAdditions'

interface HealthStatus {
  radarr: boolean
  sonarr: boolean
  prowlarr: boolean
  bazarr: boolean
  qbittorrent: boolean
}

interface CalendarItem {
  title: string
  airDateUtc?: string
  inCinemas?: string
  hasFile: boolean
}

interface DownloadItem {
  name: string
  progress: number
  state: string
}

const SEEDING_STATES = new Set(['uploading', 'stalledUP', 'forcedUP', 'queuedUP'])

interface Movie {
  hasFile: boolean
  monitored: boolean
  sizeOnDisk: number
  added: string
}

interface SeriesItem {
  monitored: boolean
  statistics: { episodeFileCount: number; episodeCount: number; sizeOnDisk: number }
  added: string
}

interface DiskSpace {
  path: string
  label: string
  freeSpace: number
  totalSpace: number
}

const MONTH_NAMES = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

function computeMonthlyData(movies: Movie[], series: SeriesItem[]) {
  const counts: Record<string, number> = {}
  const now = new Date()

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = 0
  }

  for (const m of movies) {
    if (!m.added) continue
    const key = m.added.slice(0, 7)
    if (key in counts) counts[key]++
  }

  for (const s of series) {
    if (!s.added) continue
    const key = s.added.slice(0, 7)
    if (key in counts) counts[key]++
  }

  return Object.entries(counts).map(([key, count]) => ({
    month: MONTH_NAMES[parseInt(key.split('-')[1]) - 1],
    count,
  }))
}

export default function DashboardPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [movies, setMovies] = useState<Movie[]>([])
  const [series, setSeries] = useState<SeriesItem[]>([])
  const [calendar, setCalendar] = useState<CalendarItem[]>([])
  const [downloads, setDownloads] = useState<DownloadItem[]>([])
  const [diskSpace, setDiskSpace] = useState<DiskSpace[]>([])

  useEffect(() => {
    fetch('/api/system/health').then(r => r.json()).then(setHealth).catch(() => {})
    fetch('/api/radarr/movie')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setMovies(d) })
      .catch(() => {})
    fetch('/api/sonarr/series')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSeries(d) })
      .catch(() => {})
    fetch('/api/radarr/diskspace')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setDiskSpace(d) })
      .catch(() => {})

    const now = new Date()
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
    const params = `?start=${now.toISOString()}&end=${end.toISOString()}`
    Promise.all([
      fetch(`/api/radarr/calendar${params}`).then(r => r.json()).catch(() => []),
      fetch(`/api/sonarr/calendar${params}`).then(r => r.json()).catch(() => []),
    ]).then(([m, s]) => {
      const all = [
        ...(Array.isArray(m) ? m : []),
        ...(Array.isArray(s) ? s : []),
      ]
      setCalendar(all.slice(0, 7))
    })

    const es = new EventSource('/api/stream')
    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (Array.isArray(data)) {
        setDownloads(data.map((t: { name: string; progress: number; state: string }) => ({
          name: t.name,
          progress: t.progress,
          state: t.state,
        })))
      }
    }
    return () => es.close()
  }, [])

  const movieDownloaded = movies.filter(m => m.hasFile).length
  const movieMissing = movies.filter(m => m.monitored && !m.hasFile).length
  const movieUnmonitored = movies.filter(m => !m.monitored).length
  const seriesFullyDownloaded = series.filter(s => s.statistics?.episodeFileCount === s.statistics?.episodeCount && (s.statistics?.episodeCount ?? 0) > 0).length
  const seriesMissing = series.filter(s => s.monitored && (s.statistics?.episodeFileCount ?? 0) < (s.statistics?.episodeCount ?? 0)).length
  const seriesUnmonitored = series.filter(s => !s.monitored).length

  const activeDownloads = downloads.filter(d => !SEEDING_STATES.has(d.state))

  const totalDownloaded = movieDownloaded + seriesFullyDownloaded
  const totalMissing = movieMissing + seriesMissing
  const totalUnmonitored = movieUnmonitored + seriesUnmonitored

  const movieSizeTotal = movies.reduce((sum, m) => sum + (m.sizeOnDisk || 0), 0)
  const seriesSizeTotal = series.reduce((sum, s) => sum + (s.statistics?.sizeOnDisk || 0), 0)
  const disk = diskSpace.find(d => d.path !== '/config') ?? diskSpace[0]
  const freeSpace = disk?.freeSpace ?? 0

  const monthlyData = computeMonthlyData(movies, series)
  const healthyCount = health ? Object.values(health).filter(Boolean).length : 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Panoramica del tuo media server</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Film}
          label="Film"
          value={movies.length}
          gradient="from-blue-500/20 to-blue-600/5"
          iconColor="text-blue-400"
          borderColor="border-blue-500/20"
        />
        <StatCard
          icon={Tv}
          label="Serie TV"
          value={series.length}
          gradient="from-emerald-500/20 to-emerald-600/5"
          iconColor="text-emerald-400"
          borderColor="border-emerald-500/20"
        />
        <StatCard
          icon={ArrowDownToLine}
          label="Download"
          value={activeDownloads.length}
          gradient="from-violet-500/20 to-violet-600/5"
          iconColor="text-violet-400"
          borderColor="border-violet-500/20"
        />
        <StatCard
          icon={Activity}
          label="Servizi"
          value={healthyCount}
          suffix={`/${health ? Object.keys(health).length : 0}`}
          gradient="from-amber-500/20 to-amber-600/5"
          iconColor="text-amber-400"
          borderColor="border-amber-500/20"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
        {/* Left column */}
        <div className="space-y-6">
          {disk && (
            <DiskSpaceDonut
              movieSize={movieSizeTotal}
              seriesSize={seriesSizeTotal}
              freeSpace={freeSpace}
              totalSpace={disk.totalSpace ?? 0}
            />
          )}
          <MonthlyAdditions data={monthlyData} />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <LibraryDonut
            downloaded={totalDownloaded}
            missing={totalMissing}
            unmonitored={totalUnmonitored}
          />

          {/* Service status */}
          {health && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
                Stato Servizi
              </h3>
              <div className="space-y-3">
                {Object.entries(health).map(([name, ok]) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="relative flex h-2.5 w-2.5">
                      {ok && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />}
                      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </span>
                    <span className="text-sm text-slate-300 capitalize">{name}</span>
                    <span className={`ml-auto text-xs font-medium ${ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {ok ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming releases */}
          {calendar.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Calendar size={14} className="text-slate-500" />
                Prossime Uscite
              </h3>
              <div className="space-y-2.5">
                {calendar.map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full ${item.hasFile ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    <span className="text-sm text-slate-300 truncate flex-1">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active downloads */}
          {activeDownloads.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Download size={14} className="text-slate-500" />
                Download Attivi
              </h3>
              <div className="space-y-4">
                {activeDownloads.map((d, i) => {
                  const pct = Math.round(d.progress * 100)
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs truncate flex-1 text-slate-400">{d.name}</span>
                        <span className="text-xs font-semibold text-violet-400 ml-2 tabular-nums">
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-violet-500 to-violet-400 h-full rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
  gradient,
  iconColor,
  borderColor,
}: {
  icon: React.ElementType
  label: string
  value: number
  suffix?: string
  gradient: string
  iconColor: string
  borderColor: string
}) {
  return (
    <div className={`glass-card rounded-xl p-5 bg-gradient-to-br ${gradient} border ${borderColor} transition-all duration-200 hover:scale-[1.02]`}>
      <div className={`flex items-center gap-2 mb-3 ${iconColor}`}>
        <Icon size={18} strokeWidth={2} />
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-bold text-white tabular-nums">
        {value}
        {suffix && <span className="text-lg text-slate-500 font-medium">{suffix}</span>}
      </div>
    </div>
  )
}
