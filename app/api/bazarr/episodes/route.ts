import { NextResponse } from 'next/server'
import { getBazarrEpisodes } from '@/lib/bazarr-client'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const seriesId = Number(searchParams.get('seriesId'))
  if (!seriesId) return NextResponse.json([], { status: 400 })

  const episodes = await getBazarrEpisodes(seriesId)
  return NextResponse.json(episodes)
}
