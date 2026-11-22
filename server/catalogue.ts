import { eligible } from '../shared/selection'
import type { Backdrop, Film, Movie, MoviePage, Credits, Images, Pool } from '../shared/types'
import { ApiError, createTmdb } from './tmdb'

const poolSize = 500
export const poolTtlSeconds = 6 * 60 * 60
const voteThresholds = [1000, 750, 500, 250]
const animeKeyword = '210024'

export function createCatalogue(tmdb: ReturnType<typeof createTmdb>) {
  async function buildPool(): Promise<Pool> {
    const today = new Date().toISOString().slice(0, 10)
    const movies = new Map<number, Movie>()
    let threshold = voteThresholds[0]
    let precedingThreshold: number | undefined

    for (const minimum of voteThresholds) {
      threshold = minimum
      let lastPage = 1
      for (let page = 1; page <= lastPage && movies.size < poolSize;) {
        // Limit parallel requests and avoid refetching higher vote bands.
        const pages = Array.from({ length: Math.min(5, lastPage - page + 1) }, (_, index) => page + index)
        const results = await Promise.all(pages.map(number => tmdb<MoviePage>('/discover/movie', {
          sort_by: 'vote_average.desc',
          with_original_language: 'en',
          without_keywords: animeKeyword,
          'vote_count.gte': String(minimum),
          ...(precedingThreshold === undefined ? {} : { 'vote_count.lte': String(precedingThreshold - 1) }),
          'vote_average.gte': '6.5',
          'primary_release_date.lte': today,
          include_adult: 'false',
          page: String(number),
        })))
        lastPage = Math.min(results[0].total_pages, 500)
        for (const { results: candidates } of results) {
          for (const movie of candidates) {
            if (eligible(movie, minimum, today)) movies.set(movie.id, movie)
            if (movies.size >= poolSize) break
          }
          if (movies.size >= poolSize) break
        }
        page += pages.length
      }
      if (movies.size >= poolSize) break
      precedingThreshold = minimum
    }
    if (!movies.size) throw new ApiError(503, 'TMDB returned no eligible films. Try refreshing the candidate pool.')
    return { movies: [...movies.values()], threshold, refreshedAt: Date.now() }
  }

  async function film(id: number): Promise<Film> {
    const [movie, credits, images] = await Promise.all([
      tmdb<Movie>('/movie/' + id, { language: 'en-US' }),
      tmdb<Credits>('/movie/' + id + '/credits', { language: 'en-US' }),
      tmdb<Images>('/movie/' + id + '/images'),
    ])
    function score(image: Backdrop) {
      return Math.random() + Math.min(image.width, 3840) / 3840 + image.vote_average / 10
    }
    const backdrops = images.backdrops
      .filter(image => image.file_path && image.width >= 1280 && image.height >= 660 && image.width / image.height >= 1.5)
      .map(image => ({ image, score: score(image) }))
      .sort((a, b) => Number(b.image.iso_639_1 === null) - Number(a.image.iso_639_1 === null) || b.score - a.score)
      .slice(0, 7)
      .map(({ image }) => 'https://image.tmdb.org/t/p/original' + image.file_path)
    if (!backdrops.length) throw new ApiError(422, 'This film has no suitable landscape backdrop.')
    const actors = [...credits.cast].sort((a, b) => a.order - b.order)
      .map(actor => actor.name.trim()).filter(Boolean).slice(0, 5)
    return { movie, actors, backdrops }
  }

  async function search(query: string): Promise<Movie[]> {
    const data = await tmdb<MoviePage>('/search/movie', { query, include_adult: 'false', language: 'en-US' })
    return data.results.slice(0, 12)
  }

  return { buildPool, film, search }
}
