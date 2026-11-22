import assert from 'node:assert/strict'
import test from 'node:test'
import { eligible, pickMovie, sessionIds } from '../shared/selection'
import type { Movie } from '../shared/types'

export const classic: Movie = { id: 1, title: 'Classic', release_date: '1957-04-10', original_language: 'en', vote_average: 7.2, vote_count: 2500, backdrop_path: '/classic.jpg', adult: false }

test('eligibility filters language, release dates, backdrop, adult status and vote quality', () => {
  const today = '2026-11-22'
  assert.equal(eligible(classic, 1000, today), true)
  for (const fields of [{ original_language: 'ja' }, { release_date: '' }, { release_date: '2027-01-01' }, { backdrop_path: null }, { adult: true }, { vote_average: 5 }, { vote_count: 999 }]) {
    assert.equal(eligible({ ...classic, ...fields }, 1000, today), false)
  }
})

test('weighted selection favors the higher-rated recent film while retaining a chance for classics', () => {
  const modern = { ...classic, id: 2, release_date: '2024-01-05', vote_average: 8.9 }
  const pool = [classic, modern]
  assert.equal(pickMovie(pool, new Set(), () => 0)?.id, 1)
  let modernPicks = 0
  for (let index = 0; index < 100; index++) {
    if (pickMovie(pool, new Set(), () => index / 100)?.id === modern.id) modernPicks++
  }
  assert.ok(modernPicks > 80 && modernPicks < 100)
  assert.equal(pickMovie([classic], new Set(), () => 0.99)?.id, 1)
})

test('session storage values deduplicate and exclude previously shown films', () => {
  const shown = sessionIds('[1,1,"2",null,-1]')
  assert.deepEqual([...shown], [1])
  const pool = [classic, { ...classic, id: 2 }]
  assert.equal(pickMovie(pool, shown, () => 0)?.id, 2)
  assert.equal(pickMovie(pool, new Set([1, 2])), undefined)
  assert.equal(sessionIds('bad json').size, 0)
})
