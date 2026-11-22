import assert from 'node:assert/strict'
import test from 'node:test'
import { createApi } from '../server/api'
import type { Film, Pool } from '../shared/types'

const movie = { id: 1, title: 'Test film', release_date: '1999-03-31', original_language: 'en', vote_average: 8, vote_count: 1000, backdrop_path: '/film.jpg', adult: false }
const request = (path: string, method = 'GET') => new Request('http://localhost/api' + path, { method })

test('API fills the pool over multiple pages, relaxes thresholds, caches, and refreshes', async () => {
  let discoveries = 0
  const api = createApi('test-token', async (input, options) => {
    const url = new URL(String(input))
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer test-token')
    assert.equal(url.searchParams.get('without_keywords'), '210024')
    assert.equal(url.searchParams.get('with_original_language'), 'en')
    discoveries++
    const threshold = Number(url.searchParams.get('vote_count.gte'))
    const page = Number(url.searchParams.get('page'))
    if (threshold === 1000) return Response.json({ total_pages: 1, results: [movie] })
    assert.equal(threshold, 750)
    assert.equal(url.searchParams.get('vote_count.lte'), '999')
    return Response.json({ total_pages: 25, results: Array.from({ length: 20 }, (_, i) => ({
      ...movie, id: 2 + (page - 1) * 20 + i, vote_count: 800,
    })) })
  })
  const initial = await api(request('/pool'))
  assert.equal(initial.status, 200)
  const pool = await initial.json() as Pool
  assert.equal(pool.movies.length, 500)
  assert.equal(pool.threshold, 750)
  assert.equal(discoveries, 26)
  await api(request('/pool'))
  assert.equal(discoveries, 26)
  await api(request('/pool', 'POST'))
  assert.equal(discoveries, 52)
})

test('details preserves billing order and prefers large text-free backdrops', async () => {
  const api = createApi('test-token', async input => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('/credits')) return Response.json({ cast: [{ name: 'Second', order: 1 }, { name: 'First', order: 0 }] })
    if (path.endsWith('/images')) return Response.json({ backdrops: [
      { file_path: '/small.jpg', width: 700, height: 400, iso_639_1: null, vote_average: 10 },
      { file_path: '/text.jpg', width: 1920, height: 1080, iso_639_1: 'en', vote_average: 10 },
      { file_path: '/plain.jpg', width: 1920, height: 1080, iso_639_1: null, vote_average: 7 },
    ] })
    if (path.endsWith('/search/movie')) return Response.json({ results: [movie] })
    return Response.json(movie)
  })
  const result = await api(request('/film/1'))
  assert.equal(result.status, 200)
  const film = await result.json() as Film
  assert.deepEqual(film.actors, ['First', 'Second'])
  assert.equal(film.backdrops.length, 2)
  assert.match(film.backdrops[0], /plain.jpg$/)
  const search = await api(request('/search?q=Test'))
  assert.deepEqual(await search.json(), [movie])
})

test('credentials and rate-limit failures are actionable', async () => {
  const configError = await createApi()(request('/pool'))
  assert.equal(configError.status, 503)
  assert.match((await configError.json()).message, /TMDB_READ_ACCESS_TOKEN/)
  const limited = await createApi('test-token', async () => new Response(null, {
    status: 429, headers: { 'Retry-After': '30' },
  }))(request('/pool'))
  assert.equal(limited.status, 429)
  assert.equal(limited.headers.get('Retry-After'), '30')
})
