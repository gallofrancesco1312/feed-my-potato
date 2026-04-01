'use client'
import { useEffect, useState } from 'react'
import { Download, AlertCircle } from 'lucide-react'
import { TorrentRow } from '@/components/TorrentRow'
import type { Torrent } from '@/lib/qbittorrent'

interface QueueRecord {
  downloadId: string
  title: string
}

export default function DownloadsPage() {
  const [torrents, setTorrents] = useState<Torrent[]>([])
  const [radarrQueue, setRadarrQueue] = useState<QueueRecord[]>([])
  const [sonarrQueue, setSonarrQueue] = useState<QueueRecord[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    const es = new EventSource('/api/stream')
    es.onmessage = e => {
      const data = JSON.parse(e.data)
      if (Array.isArray(data)) {
        setTorrents(data)
        setError('')
      } else {
        setError('qBittorrent non raggiungibile')
      }
    }
    es.onerror = () => setError('Connessione SSE interrotta')

    fetch('/api/radarr/queue')
      .then(r => r.json())
      .then(d => {
        if (d?.records) setRadarrQueue(d.records)
      })
      .catch(() => {})
    fetch('/api/sonarr/queue')
      .then(r => r.json())
      .then(d => {
        if (d?.records) setSonarrQueue(d.records)
      })
      .catch(() => {})

    return () => es.close()
  }, [])

  const getLabel = (hash: string): 'Film' | 'Serie' | null => {
    const h = hash.toLowerCase()
    if (radarrQueue.some(q => q.downloadId?.toLowerCase() === h)) return 'Film'
    if (sonarrQueue.some(q => q.downloadId?.toLowerCase() === h)) return 'Serie'
    return null
  }

  const deleteTorrent = async (hash: string, deleteFiles: boolean) => {
    await fetch(`/api/qbit/torrents/${hash}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deleteFiles }),
    })
  }

  const togglePause = async (hash: string, isPaused: boolean) => {
    await fetch('/api/qbit/torrents', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hash, action: isPaused ? 'resume' : 'pause' }),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Download</h1>
        <p className="text-sm text-slate-500 mt-1">
          {torrents.length > 0
            ? `${torrents.length} torrent attivi`
            : 'Gestione download in tempo reale'}
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-300">
            {error} &mdash;{' '}
            <a href="/system" className="underline hover:text-red-200 transition-colors">
              Controlla il sistema
            </a>
          </p>
        </div>
      )}

      {torrents.length === 0 && !error && (
        <div className="glass-card rounded-xl p-12 text-center">
          <Download size={40} className="text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Nessun download attivo.</p>
          <p className="text-sm text-slate-600 mt-1">I nuovi download appariranno qui automaticamente.</p>
        </div>
      )}

      <div className="space-y-4">
        {torrents.map(t => (
          <TorrentRow
            key={t.hash}
            torrent={t}
            onDelete={deleteTorrent}
            onTogglePause={togglePause}
            label={getLabel(t.hash)}
          />
        ))}
      </div>
    </div>
  )
}
