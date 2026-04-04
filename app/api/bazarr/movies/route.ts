import { NextResponse } from 'next/server'
import { getBazarrMovies } from '@/lib/bazarr-client'

export async function GET() {
  const movies = await getBazarrMovies()
  return NextResponse.json(movies)
}
