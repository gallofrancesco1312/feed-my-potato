'use client'
import { useEffect, useState } from 'react'
import { Settings, CheckCircle, XCircle, Loader2, Save, Eye, EyeOff } from 'lucide-react'

interface Config {
  radarr: { url: string; apiKey: string }
  sonarr: { url: string; apiKey: string }
  prowlarr: { url: string; apiKey: string }
  bazarr: { url: string; apiKey: string }
  qbittorrent: { url: string; username: string; password: string }
}

interface HealthStatus {
  radarr: boolean
  sonarr: boolean
  prowlarr: boolean
  bazarr: boolean
  qbittorrent: boolean
}

export default function SystemPage() {
  const [cfg, setCfg] = useState<Config | null>(null)
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [saved, setSaved] = useState(false)
  const [tests, setTests] = useState<Record<string, boolean | null>>({})
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(setCfg)
    fetch('/api/system/health').then(r => r.json()).then(setHealth)
  }, [])

  const save = async () => {
    await fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const testService = async (service: string) => {
    setTests(t => ({ ...t, [service]: null }))
    const res = await fetch(`/api/test/${service}`)
    const { ok } = await res.json()
    setTests(t => ({ ...t, [service]: ok }))
  }

  if (!cfg) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div className="h-8 w-32 bg-white/[0.04] rounded-lg animate-pulse" />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const arrServices = ['radarr', 'sonarr', 'prowlarr', 'bazarr'] as const
  const portMap = { radarr: '7878', sonarr: '8989', prowlarr: '9696', bazarr: '6767' }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Sistema</h1>
        <p className="text-sm text-slate-500 mt-1">Configurazione servizi e connessioni</p>
      </div>

      {/* Health overview */}
      {health && (
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
            Stato Servizi
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {Object.entries(health).map(([name, ok]) => (
              <div
                key={name}
                className={`flex items-center gap-2.5 p-3 rounded-xl ${
                  ok ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-red-500/10 border border-red-500/20'
                }`}
              >
                {ok ? (
                  <CheckCircle size={16} className="text-emerald-400" />
                ) : (
                  <XCircle size={16} className="text-red-400" />
                )}
                <span className={`text-sm font-medium capitalize ${ok ? 'text-emerald-300' : 'text-red-300'}`}>
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service configs */}
      {arrServices.map(service => (
        <div key={service} className="glass-card rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-white capitalize flex items-center gap-2">
              <Settings size={16} className="text-slate-500" />
              {service}
            </h2>
            <button
              onClick={() => testService(service)}
              className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              {tests[service] === null ? (
                <Loader2 size={12} className="animate-spin" />
              ) : tests[service] === true ? (
                <CheckCircle size={12} className="text-emerald-400" />
              ) : tests[service] === false ? (
                <XCircle size={12} className="text-red-400" />
              ) : null}
              {tests[service] === null
                ? 'Testing...'
                : tests[service] === true
                  ? 'Connesso'
                  : tests[service] === false
                    ? 'Errore'
                    : 'Test connessione'}
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">URL</label>
              <input
                value={cfg[service].url}
                onChange={e =>
                  setCfg({ ...cfg, [service]: { ...cfg[service], url: e.target.value } })
                }
                placeholder={`http://localhost:${portMap[service]}`}
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">API Key</label>
              <input
                value={cfg[service].apiKey}
                onChange={e =>
                  setCfg({ ...cfg, [service]: { ...cfg[service], apiKey: e.target.value } })
                }
                placeholder="API Key"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all font-mono text-xs"
              />
            </div>
          </div>
        </div>
      ))}

      {/* qBittorrent */}
      <div className="glass-card rounded-xl p-5 space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Settings size={16} className="text-slate-500" />
            qBittorrent
          </h2>
          <button
            onClick={() => testService('qbittorrent')}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 transition-colors cursor-pointer"
          >
            {tests.qbittorrent === null ? (
              <Loader2 size={12} className="animate-spin" />
            ) : tests.qbittorrent === true ? (
              <CheckCircle size={12} className="text-emerald-400" />
            ) : tests.qbittorrent === false ? (
              <XCircle size={12} className="text-red-400" />
            ) : null}
            {tests.qbittorrent === null
              ? 'Testing...'
              : tests.qbittorrent === true
                ? 'Connesso'
                : tests.qbittorrent === false
                  ? 'Errore'
                  : 'Test connessione'}
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">URL</label>
            <input
              value={cfg.qbittorrent.url}
              onChange={e =>
                setCfg({
                  ...cfg,
                  qbittorrent: { ...cfg.qbittorrent, url: e.target.value },
                })
              }
              placeholder="http://localhost:8080"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Username</label>
            <input
              value={cfg.qbittorrent.username}
              onChange={e =>
                setCfg({
                  ...cfg,
                  qbittorrent: { ...cfg.qbittorrent, username: e.target.value },
                })
              }
              placeholder="admin"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={cfg.qbittorrent.password}
                onChange={e =>
                  setCfg({
                    ...cfg,
                    qbittorrent: { ...cfg.qbittorrent, password: e.target.value },
                  })
                }
                placeholder="Password"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder:text-slate-600 focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={save}
        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
          saved
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : 'bg-violet-600 text-white hover:bg-violet-500 shadow-lg shadow-violet-500/20'
        }`}
      >
        {saved ? (
          <>
            <CheckCircle size={16} />
            Salvato
          </>
        ) : (
          <>
            <Save size={16} />
            Salva Configurazione
          </>
        )}
      </button>
    </div>
  )
}
