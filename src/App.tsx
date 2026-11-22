import { useEffect, useRef, useState } from 'react'
import { Clapperboard, Film as FilmIcon, Info, LoaderCircle, Shuffle, UsersRound } from 'lucide-react'
import { pickMovie, sessionIds } from '../shared/selection'
import type { Film, Pool } from '../shared/types'
import { getJson, loadBackdrop, RequestError } from './api'
import TestingTools from './TestingTools'

const sessionKey = 'film-bingo-shown'
type ScreenedFilm = Film & { image: string }

function readSession() {
  try { return sessionIds(sessionStorage.getItem(sessionKey)) }
  catch { return new Set<number>() }
}

export default function App() {
  const [used, setUsed] = useState(readSession)
  const usedRef = useRef(used)
  const [film, setFilm] = useState<ScreenedFilm>()
  const [pool, setPool] = useState<Pool>()
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [exhausted, setExhausted] = useState(false)
  const locked = useRef(false)
  const started = useRef(false)

  function saveSession(ids: Set<number>) {
    usedRef.current = ids
    setUsed(ids)
    try { sessionStorage.setItem(sessionKey, JSON.stringify([...ids])) } catch { /* Keep this tab's in-memory history. */ }
  }

  function reset() {
    saveSession(new Set())
    setExhausted(false)
    setError('')
    setNotice('Session history cleared.')
  }

  async function openFilm(id: number): Promise<ScreenedFilm> {
    const candidate = await getJson<Film>('/api/film/' + id)
    for (const image of candidate.backdrops) {
      if (await loadBackdrop(image)) return { ...candidate, image }
    }
    throw new RequestError(422, 'The backdrops for this film could not be loaded.')
  }

  async function run(mode: 'next' | 'manual' | 'refresh', id?: number) {
    if (locked.current) return
    locked.current = true
    setBusy(true)
    setError('')
    setNotice('')
    try {
      let selected: ScreenedFilm | undefined
      if (mode === 'manual' && id !== undefined) {
        if (usedRef.current.has(id)) return
        selected = await openFilm(id)
      } else {
        const catalogue = await getJson<Pool>('/api/pool', { method: mode === 'refresh' ? 'POST' : 'GET' })
        setPool(catalogue)
        if (mode === 'refresh') {
          setExhausted(catalogue.movies.every(movie => usedRef.current.has(movie.id)))
          setNotice('Candidate pool refreshed.')
          return
        }
        const excluded = new Set(usedRef.current)
        const first = pickMovie(catalogue.movies, excluded)
        setExhausted(!first)
        if (!first) return
        let candidate = first
        for (let attempt = 0; attempt < 8 && candidate; attempt++) {
          try {
            selected = await openFilm(candidate.id)
            break
          } catch (failure) {
            if (!(failure instanceof RequestError) || ![404, 422].includes(failure.status)) throw failure
            excluded.add(candidate.id)
            const next = pickMovie(catalogue.movies, excluded)
            if (!next) break
            candidate = next
          }
        }
        if (!selected) throw new Error('No loadable backdrop was found. Try another selection.')
      }
      if (selected) {
        setFilm(selected)
        saveSession(new Set([...usedRef.current, selected.movie.id]))
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.')
    } finally {
      locked.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void run('next')
  }, [])

  const current = film?.movie
  const year = current?.release_date?.match(/^\d{4}/)?.[0]
  const poolShown = pool?.movies.filter(movie => used.has(movie.id)).length ?? 0
  return <>
    <header className="masthead"><div className="shell masthead-inner">
      <div className="brand"><span className="brand-icon"><Clapperboard size={22} /></span><span>Film<span className="accent">Bingo</span></span></div>
      <span className="header-label"><FilmIcon size={15} /> Screening Room</span>
    </div></header>
    <main className="shell">
      <section className="intro"><h1>Screening Room</h1><p>Discover a film, take in the backdrop, and see who’s on the bill.</p></section>
      <section className="screening" aria-label="Current film" aria-busy={busy}>
        <div className={'screen' + (film ? ' has-film' : '')}>
          {film ? <img key={film.image} src={film.image} alt={current?.title + ' film backdrop'} onError={() => {
            if (!locked.current) {
              setFilm(undefined)
              void run('next')
            }
          }} /> : <div className="screen-empty">
            <span className="empty-icon">{busy ? <LoaderCircle size={30} className="spin" /> : <FilmIcon size={34} />}</span>
            <h2>{busy ? 'Loading film' : exhausted ? 'Session complete' : 'Ready when you are'}</h2>
            <p>{busy ? 'Finding a film and its backdrop…' : exhausted ? 'Reset the session to see films again.' : 'Your film backdrop will appear here.'}</p>
          </div>}
          {busy && film && <div className="loading-overlay" role="status"><LoaderCircle size={23} className="spin" /> Loading film…</div>}
        </div>
        <div className="film-bar">
          <div className="film-heading"><span className="eyebrow">NOW SCREENING</span><div className="title-row"><h2>{current?.title ?? 'Awaiting selection'}</h2>{year && <span className="year">{year}</span>}</div></div>
          <div className="next-wrap">
            <button className="primary" disabled={busy} onClick={() => { if (exhausted) reset(); void run('next') }}>
              {busy ? <LoaderCircle size={19} className="spin" /> : <Shuffle size={19} />}
              {busy ? 'Loading…' : exhausted ? 'Reset Session' : error && !film ? 'Try Again' : 'Next Film'}
            </button>
            {pool && <span className="progress">{poolShown} of {pool.movies.length} pool films shown</span>}
          </div>
        </div>
        {error && <div className="message error" role="alert"><Info size={17} /> <span>{error}</span></div>}
        {!error && (exhausted || notice) && <div className="message" role="status">{exhausted ? 'You’ve seen every film in the candidate pool. Reset the session to start again.' : notice}</div>}
        <div className="cast">
          <h3><UsersRound size={17} /> Top 5 Billed Actors</h3>
          {film && film.actors.length > 0 && <ol>{film.actors.map((actor, i) => <li key={i}><span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>{actor}</li>)}</ol>}
          {(!film || film.actors.length < 5) && <p>{!film ? 'Cast details will appear with the film.' : film.actors.length ? 'TMDB lists fewer than five billed actors for this film.' : 'TMDB did not return billed cast for this film.'}</p>}
        </div>
      </section>
      <TestingTools busy={busy} movie={current} pool={pool} used={used} onSelect={id => void run('manual', id)} onReset={reset} onRefresh={() => void run('refresh')} />
      <footer><span>Film Bingo</span><details><summary>About / Credits</summary><p>Film data and backdrops provided by <a href="https://www.themoviedb.org/">The Movie Database</a>.</p><a href="https://www.themoviedb.org/" aria-label="The Movie Database"><img className="tmdb-logo" alt="TMDB" src="/tmdb.svg" /></a><p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p></details></footer>
    </main>
  </>
}
