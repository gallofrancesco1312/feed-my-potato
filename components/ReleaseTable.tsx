'use client'

import { useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, Download, Loader2, Check } from 'lucide-react'
import { toast } from 'sonner'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'

export interface Release {
  title: string
  quality?: { quality: { name: string } }
  languages?: { id: number; name: string }[]
  indexer: string
  age: number
  size: number
  seeders: number
  leechers: number
  guid: string
  indexerId: number
  downloadUrl?: string
}

type SortField = 'seeders' | 'leechers' | 'size' | 'age' | 'quality'
type SortDir = 'asc' | 'desc'

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatAge(days: number): string {
  if (days < 1) return '<1g'
  if (days < 365) return `${Math.round(days)}g`
  return `${(days / 365).toFixed(1)}a`
}

function parseResolution(title: string): string {
  if (/\b(2160p|4K|UHD)\b/i.test(title)) return '4K'
  if (/\b1080p\b/i.test(title)) return '1080p'
  if (/\b720p\b/i.test(title)) return '720p'
  if (/\b480p\b/i.test(title)) return '480p'
  return ''
}

function parseLanguage(title: string): string[] {
  const langs: string[] = []
  if (/\b(MULTI|DUAL)\b/i.test(title)) return ['ITA', 'ENG']
  if (/\bITA(LIAN)?\b/i.test(title)) langs.push('ITA')
  if (/\bENG(LISH)?\b/i.test(title)) langs.push('ENG')
  return langs
}

function effectiveResolution(release: Release): string {
  return release.quality?.quality.name || parseResolution(release.title)
}

function effectiveLanguages(release: Release): string[] {
  if (release.languages && release.languages.length > 0) {
    return release.languages.map(l => l.name)
  }
  return parseLanguage(release.title)
}

interface ReleaseTableProps {
  releases: Release[]
  onGrab: (guid: string, indexerId: number) => Promise<void>
}

export function ReleaseTable({ releases, onGrab }: ReleaseTableProps) {
  const [sortField, setSortField] = useState<SortField>('seeders')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [grabbing, setGrabbing] = useState<string | null>(null)
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set())

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sorted = [...releases].sort((a, b) => {
    let va: number | string
    let vb: number | string
    if (sortField === 'quality') {
      va = a.quality?.quality.name ?? ''
      vb = b.quality?.quality.name ?? ''
    } else {
      va = a[sortField]
      vb = b[sortField]
    }
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="text-slate-600" />
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-violet-400" /> : <ArrowDown size={12} className="text-violet-400" />
  }

  const handleGrab = async (release: Release) => {
    setGrabbing(release.guid)
    try {
      await onGrab(release.guid, release.indexerId)
      setGrabbed(prev => new Set(prev).add(release.guid))
      toast.success(`Download avviato: ${release.title}`)
    } catch (err) {
      toast.error(`Errore nel download: ${err instanceof Error ? err.message : 'sconosciuto'}`)
    } finally {
      setGrabbing(null)
    }
  }

  if (releases.length === 0) {
    return <p className="text-sm text-slate-500 py-6 px-2 text-center">Nessun torrent trovato</p>
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-white/[0.06] hover:bg-transparent">
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Nome</TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('quality')}>
              <span className="flex items-center gap-1">Qualit&agrave; <SortIcon field="quality" /></span>
            </TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Lingua</TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Indexer</TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('age')}>
              <span className="flex items-center gap-1">Et&agrave; <SortIcon field="age" /></span>
            </TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('size')}>
              <span className="flex items-center gap-1">Dim. <SortIcon field="size" /></span>
            </TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('seeders')}>
              <span className="flex items-center gap-1">Seed <SortIcon field="seeders" /></span>
            </TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer select-none" onClick={() => toggleSort('leechers')}>
              <span className="flex items-center gap-1">Leech <SortIcon field="leechers" /></span>
            </TableHead>
            <TableHead className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider w-10">Azione</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map(release => (
            <TableRow key={release.guid} className="border-white/[0.04] hover:bg-white/[0.02] transition-colors">
              <TableCell className="text-xs max-w-[300px] truncate text-slate-300" title={release.title}>
                {release.title}
              </TableCell>
              <TableCell>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/[0.06] text-slate-400">
                  {release.quality?.quality.name ?? '—'}
                </span>
              </TableCell>
              <TableCell className="text-xs text-slate-400">
                {release.languages?.map(l => l.name).join(', ') || '\u2014'}
              </TableCell>
              <TableCell className="text-xs text-slate-500">{release.indexer}</TableCell>
              <TableCell className="text-xs text-slate-400 tabular-nums">{formatAge(release.age)}</TableCell>
              <TableCell className="text-xs text-slate-400 tabular-nums">{formatSize(release.size)}</TableCell>
              <TableCell className="text-xs font-semibold text-emerald-400 tabular-nums">{release.seeders}</TableCell>
              <TableCell className="text-xs text-red-400 tabular-nums">{release.leechers}</TableCell>
              <TableCell>
                {release.downloadUrl ? (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    onClick={() => handleGrab(release)}
                    disabled={grabbing === release.guid || grabbed.has(release.guid)}
                    className="cursor-pointer hover:bg-white/[0.06]"
                  >
                    {grabbed.has(release.guid) ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : grabbing === release.guid ? (
                      <Loader2 size={14} className="animate-spin text-violet-400" />
                    ) : (
                      <Download size={14} className="text-slate-400" />
                    )}
                  </Button>
                ) : (
                  <span title="Nessun link disponibile">
                    <Download size={14} className="text-slate-700" />
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
