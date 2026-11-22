import type { Movie } from './types'

export function eligible(movie: Movie, threshold: number, today: string): boolean {
  const date = movie.release_date
  return movie.original_language === 'en' && !movie.adult && Boolean(movie.backdrop_path)
    && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && date <= today
    && movie.vote_average >= 6.5 && movie.vote_count >= threshold
}

export function pickMovie(pool: Movie[], excluded: ReadonlySet<number>, random = Math.random): Movie | undefined {
  const available = pool.filter(movie => !excluded.has(movie.id))
  if (!available.length) return undefined
  const ratings = pool.map(movie => movie.vote_average)
  const dates = pool.map(movie => Date.parse(movie.release_date))
  const minRating = Math.min(...ratings)
  const minDate = Math.min(...dates)
  const ratingRange = Math.max(...ratings) - minRating || 1
  const dateRange = Math.max(...dates) - minDate || 1
  const weights = available.map(movie =>
    0.12 + 0.65 * (movie.vote_average - minRating) / ratingRange
      + 0.35 * (Date.parse(movie.release_date) - minDate) / dateRange,
  )
  let remaining = random() * weights.reduce((sum, weight) => sum + weight, 0)
  for (const [index, weight] of weights.entries()) {
    remaining -= weight
    if (remaining < 0) return available[index]
  }
  return available.at(-1)
}

export function sessionIds(raw: string | null): Set<number> {
  try {
    const value: unknown = JSON.parse(raw ?? '[]')
    return new Set(Array.isArray(value) ? value.filter(id => Number.isSafeInteger(id) && id > 0) : [])
  } catch {
    return new Set()
  }
}
