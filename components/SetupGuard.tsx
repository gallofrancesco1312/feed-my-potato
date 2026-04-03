'use client'

import { useEffect, useRef } from 'react'

/**
 * Runs once on app load to ensure Sonarr/Radarr have qBittorrent
 * configured as their download client.
 */
export function SetupGuard() {
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    fetch('/api/setup', { method: 'POST' }).catch(() => {})
  }, [])

  return null
}
