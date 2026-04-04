'use client'
import { useEffect, useState } from 'react'
import { Film, MoreVertical, EyeOff, Trash2, AlertTriangle, Languages } from 'lucide-react'
import { toast } from 'sonner'

interface Movie {
  id: number
  title: string
  year: number
  monitored: boolean
  hasFile: boolean
  images: { coverType: string; remoteUrl: string }[]
}

interface BazarrMovie {
  radarrId: number
  subtitles: { name: string; code2: string; path: string | null }[]
  missing_subtitles: { name: string; code2: string }[]
}

type Filter = 'all' | 'monitored' | 'missing' | 'downloaded'

const FILTER_LABELS: Record<Filter, string> = {
  all: 'Tutti',
  monitored: 'Monitorati',
  missing: 'Mancanti',
  downloaded: 'Scaricati',
}

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [bazarrMovies, setBazarrMovies] = useState<BazarrMovie[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [deleteFiles, setDeleteFiles] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/radarr/movie').then(r => r.json()),
      fetch('/api/bazarr/movies').then(r => r.json()).catch(() => []),
    ]).then(([movieData, subData]) => {
      if (Array.isArray(movieData)) setMovies(movieData)
      if (Array.isArray(subData)) setBazarrMovies(subData)
    }).finally(() => setLoading(false))
  }, [])

  const filtered = movies.filter(m => {
    if (filter === 'monitored') return m.monitored
    if (filter === 'missing') return m.monitored && !m.hasFile
    if (filter === 'downloaded') return m.hasFile
    return true
  })

  const unmonitor = async (id: number) => {
    setMenuOpen(null)
    try {
      const res = await fetch(`/api/radarr/movie/${id}`)
      const movie = await res.json()
      movie.monitored = false
      await fetch(`/api/radarr/movie/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(movie),
      })
      setMovies(prev => prev.map(m => (m.id === id ? { ...m, monitored: false } : m)))
      toast.success('Monitoraggio disattivato')
    } catch {
      toast.error('Errore durante la disattivazione del monitoraggio')
    }
  }

  const deleteMovie = async (id: number) => {
    const shouldDeleteFiles = deleteFiles
    setConfirmDelete(null)
    setMenuOpen(null)
    try {
      await fetch(`/api/radarr/movie/${id}?deleteFiles=${shouldDeleteFiles}`, { method: 'DELETE' })
      setMovies(prev => prev.filter(m => m.id !== id))
      toast.success(shouldDeleteFiles ? 'Film e file rimossi' : 'Film rimosso dalla libreria')
    } catch {
      toast.error('Errore durante la rimozione del film')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl overflow-hidden">
              <div className="w-full aspect-[2/3] bg-white/[0.04] animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 w-3/4 bg-white/[0.04] rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-white/[0.04] rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Film</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length} film in libreria</p>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {(Object.keys(FILTER_LABELS) as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-4 py-2 rounded-full transition-all duration-200 cursor-pointer ${
              filter === f
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                : 'bg-white/[0.04] text-slate-400 border border-transparent hover:bg-white/[0.06] hover:text-slate-300'
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filtered.map(movie => {
          const poster = movie.images.find(i => i.coverType === 'poster')
          return (
            <div
              key={movie.id}
              className="glass-card rounded-xl overflow-hidden relative group transition-all duration-300 hover:scale-[1.03] hover:glow-violet-sm"
            >
              {poster ? (
                <img
                  src={poster.remoteUrl}
                  alt={movie.title}
                  className="w-full aspect-[2/3] object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-white/[0.04] flex items-center justify-center">
                  <Film size={32} className="text-slate-700" />
                </div>
              )}

              {/* Gradient overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Action menu trigger */}
              <button
                onClick={() => setMenuOpen(menuOpen === movie.id ? null : movie.id)}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-black/70 cursor-pointer"
              >
                <MoreVertical size={16} className="text-white" />
              </button>

              {/* Dropdown menu */}
              {menuOpen === movie.id && (
                <div className="absolute top-10 right-2 glass-card-elevated rounded-xl shadow-xl z-10 min-w-[180px] overflow-hidden">
                  <button
                    onClick={() => unmonitor(movie.id)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                  >
                    <EyeOff size={14} className="text-slate-400" />
                    Disattiva monitoraggio
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(null)
                      setConfirmDelete(movie.id)
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} />
                    Elimina dalla libreria
                  </button>
                </div>
              )}

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-semibold truncate text-white">{movie.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-slate-500">{movie.year}</span>
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const bm = bazarrMovies.find(b => b.radarrId === movie.id)
                      const subLangs = bm?.subtitles?.filter(s => s.path).map(s => s.code2.toUpperCase()) ?? []
                      if (movie.hasFile && subLangs.length > 0) {
                        return (
                          <span className="flex items-center gap-0.5 text-[10px] text-emerald-400" title={`Sottotitoli: ${subLangs.join(', ')}`}>
                            <Languages size={11} />
                            {subLangs.join(', ')}
                          </span>
                        )
                      }
                      if (movie.hasFile) {
                        return (
                          <span className="text-slate-600" title="Nessun sottotitolo">
                            <Languages size={11} />
                          </span>
                        )
                      }
                      return null
                    })()}
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        movie.hasFile
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : movie.monitored
                            ? 'bg-amber-500/15 text-amber-400'
                            : 'bg-white/[0.06] text-slate-500'
                      }`}
                    >
                      {movie.hasFile
                        ? 'Scaricato'
                        : movie.monitored
                          ? 'Mancante'
                          : 'Non monitorato'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Delete confirmation modal */}
              {confirmDelete === movie.id && (
                <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 z-20">
                  <AlertTriangle size={24} className="text-red-400 mb-3" />
                  <p className="text-sm text-center text-slate-300 mb-2 leading-relaxed">
                    Sei sicuro? Il film verr&agrave; rimosso da Radarr. Questa azione &egrave; irreversibile.
                  </p>
                  <label className="flex items-center gap-2 mb-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deleteFiles}
                      onChange={e => setDeleteFiles(e.target.checked)}
                      className="accent-red-500 w-3.5 h-3.5"
                    />
                    <span className="text-xs text-slate-300">Elimina anche i file dal disco</span>
                  </label>
                  {deleteFiles && (
                    <p className="text-[11px] text-red-400 mb-3">I file verranno eliminati permanentemente.</p>
                  )}
                  {!deleteFiles && <div className="mb-3" />}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="px-4 py-2 text-sm rounded-lg bg-white/[0.06] text-slate-300 hover:bg-white/[0.1] transition-colors cursor-pointer"
                    >
                      Annulla
                    </button>
                    <button
                      onClick={() => deleteMovie(movie.id)}
                      className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors cursor-pointer"
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
