export interface Torrent {
  hash: string
  name: string
  progress: number
  dlspeed: number
  upspeed: number
  eta: number
  size: number
  total_size: number
  uploaded: number
  downloaded: number
  ratio: number
  num_seeds: number
  num_leechs: number
  added_on: number
  tracker: string
  category: string
  state: string
  savePath: string
  contentPath: string
}

export class QBittorrentClient {
  private cookie = ''

  constructor(
    private baseUrl: string,
    private username: string,
    private password: string,
  ) {}

  private async login(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: this.username, password: this.password }),
    })
    const body = await res.text()
    if (body.trim() === 'Fails.') throw new Error('qBittorrent authentication failed: bad credentials')
    const setCookie = res.headers?.get('set-cookie') ?? ''
    this.cookie = setCookie.split(';')[0]
  }

  private async call(path: string, init?: RequestInit): Promise<Response> {
    if (!this.cookie) await this.login()
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), Cookie: this.cookie },
    })
    // Re-authenticate on session expiry
    if (res.status === 403) {
      this.cookie = ''
      await this.login()
      return fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...(init?.headers ?? {}), Cookie: this.cookie },
      })
    }
    return res
  }

  async getTorrents(): Promise<Torrent[]> {
    const res = await this.call('/api/v2/torrents/info')
    return res.json()
  }

  async addMagnet(magnetUri: string, savePath?: string): Promise<void> {
    const body = new URLSearchParams({ urls: magnetUri })
    if (savePath) body.set('savepath', savePath)
    await this.call('/api/v2/torrents/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async addTorrentUrl(url: string, category?: string, savePath?: string): Promise<void> {
    const body = new URLSearchParams({ urls: url })
    if (category) body.set('category', category)
    if (savePath) body.set('savepath', savePath)
    await this.call('/api/v2/torrents/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async deleteTorrent(hash: string, deleteFiles: boolean): Promise<void> {
    const body = new URLSearchParams({ hashes: hash, deleteFiles: String(deleteFiles) })
    await this.call('/api/v2/torrents/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async pauseTorrent(hash: string): Promise<void> {
    const body = new URLSearchParams({ hashes: hash })
    await this.call('/api/v2/torrents/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async resumeTorrent(hash: string): Promise<void> {
    const body = new URLSearchParams({ hashes: hash })
    await this.call('/api/v2/torrents/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.login()
      return this.cookie !== ''
    } catch {
      return false
    }
  }
}
