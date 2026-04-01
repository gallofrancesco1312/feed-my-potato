import {
  formatSize,
  formatDate,
  extractTrackerHost,
  getStateConfig,
  BADGE_COLORS,
} from '@/lib/torrent-utils'

describe('formatSize', () => {
  test('formats bytes as KB', () => {
    expect(formatSize(512)).toBe('512 B')
  })

  test('formats kilobytes', () => {
    expect(formatSize(15_000)).toBe('14.6 KB')
  })

  test('formats megabytes', () => {
    expect(formatSize(850_000_000)).toBe('810.6 MB')
  })

  test('formats gigabytes', () => {
    expect(formatSize(4_500_000_000)).toBe('4.2 GB')
  })

  test('formats terabytes', () => {
    expect(formatSize(1_200_000_000_000)).toBe('1.1 TB')
  })

  test('formats zero', () => {
    expect(formatSize(0)).toBe('0 B')
  })
})

describe('formatDate', () => {
  test('formats unix timestamp as Italian date', () => {
    // 2026-03-25 12:00:00 UTC
    const result = formatDate(1774440000)
    expect(result).toMatch(/25 mar 2026/)
  })

  test('returns empty string for zero', () => {
    expect(formatDate(0)).toBe('')
  })
})

describe('extractTrackerHost', () => {
  test('extracts hostname from tracker URL', () => {
    expect(extractTrackerHost('udp://tracker.example.com:6969/announce')).toBe(
      'tracker.example.com',
    )
  })

  test('extracts hostname from HTTP tracker', () => {
    expect(extractTrackerHost('https://tracker.site.org:443/announce')).toBe(
      'tracker.site.org',
    )
  })

  test('returns raw string if not a valid URL', () => {
    expect(extractTrackerHost('not-a-url')).toBe('not-a-url')
  })

  test('returns empty string for empty input', () => {
    expect(extractTrackerHost('')).toBe('')
  })
})

describe('getStateConfig', () => {
  test('returns config for downloading state', () => {
    const cfg = getStateConfig('downloading')
    expect(cfg.label).toBe('Scaricando')
    expect(cfg.color).toBe('blue')
  })

  test('returns config for stalledUP state', () => {
    const cfg = getStateConfig('stalledUP')
    expect(cfg.label).toBe('In seeding')
    expect(cfg.color).toBe('green')
  })

  test('returns config for error state', () => {
    const cfg = getStateConfig('error')
    expect(cfg.label).toBe('Errore')
    expect(cfg.color).toBe('red')
  })

  test('returns unknown config for unrecognized state', () => {
    const cfg = getStateConfig('something_new')
    expect(cfg.label).toBe('something_new')
    expect(cfg.color).toBe('gray')
  })
})

describe('BADGE_COLORS', () => {
  test('has entries for all color families', () => {
    expect(BADGE_COLORS.blue).toBeDefined()
    expect(BADGE_COLORS.green).toBeDefined()
    expect(BADGE_COLORS.yellow).toBeDefined()
    expect(BADGE_COLORS.gray).toBeDefined()
    expect(BADGE_COLORS.red).toBeDefined()
  })
})
