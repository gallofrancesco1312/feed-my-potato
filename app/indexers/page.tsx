'use client'
import { useEffect, useState } from 'react'
import { Globe, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react'

interface Indexer {
  id: number
  name: string
  protocol: string
  enable: boolean
  fields: { name: string; value: unknown }[]
}

export default function IndexersPage() {
  const [indexers, setIndexers] = useState<Indexer[]>([])
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState<number | null>(null)
  const [testResults, setTestResults] = useState<Record<number, boolean>>({})
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/prowlarr/indexer')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setIndexers(data)
      })
      .finally(() => setLoading(false))
  }, [])

  const testIndexer = async (id: number) => {
    setTesting(id)
    try {
      const res = await fetch(`/api/prowlarr/indexer/${id}/test`, { method: 'POST' })
      setTestResults(prev => ({ ...prev, [id]: res.ok }))
    } catch {
      setTestResults(prev => ({ ...prev, [id]: false }))
    } finally {
      setTesting(null)
    }
  }

  const syncApps = async () => {
    setSyncing(true)
    await fetch('/api/prowlarr/applicationsync', { method: 'POST' })
    setSyncing(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-16 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Indexer</h1>
          <p className="text-sm text-slate-500 mt-1">{indexers.length} indexer configurati</p>
        </div>
        <button
          onClick={syncApps}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white/[0.04] text-slate-300 rounded-xl hover:bg-white/[0.06] border border-white/[0.08] transition-all duration-200 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          Sync Applicazioni
        </button>
      </div>

      {indexers.length === 0 && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Globe size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessun indexer configurato.</p>
          <p className="text-sm text-slate-600 mt-1">Configura gli indexer in Prowlarr.</p>
        </div>
      )}

      <div className="space-y-3">
        {indexers.map(ix => (
          <div
            key={ix.id}
            className="glass-card rounded-xl p-4 flex items-center gap-4 transition-all duration-200 hover:border-white/[0.1]"
          >
            {/* Status indicator */}
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              {ix.enable && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${ix.enable ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            </span>

            {/* Name & protocol */}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm text-white">{ix.name}</span>
              <p className="text-xs text-slate-500 mt-0.5">{ix.protocol}</p>
            </div>

            {/* Test result */}
            {testResults[ix.id] !== undefined && (
              <span className="flex items-center gap-1.5">
                {testResults[ix.id] ? (
                  <CheckCircle size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-red-400" />
                )}
                <span className={`text-xs font-medium ${testResults[ix.id] ? 'text-emerald-400' : 'text-red-400'}`}>
                  {testResults[ix.id] ? 'OK' : 'Errore'}
                </span>
              </span>
            )}

            {/* Test button */}
            <button
              onClick={() => testIndexer(ix.id)}
              disabled={testing === ix.id}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium bg-white/[0.04] text-slate-300 rounded-lg hover:bg-white/[0.06] border border-white/[0.08] transition-all duration-200 disabled:opacity-50 cursor-pointer"
            >
              {testing === ix.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                'Test'
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
