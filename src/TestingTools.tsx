import { useEffect, useState } from 'react'
import { ChevronDown, FlaskConical, RefreshCw, RotateCcw, Search } from 'lucide-react'
import type { Movie, Pool } from '../shared/types'
import { getJson } from './api'

interface Props {
  busy: boolean
  movie?: Movie
  pool?: Pool
  used: ReadonlySet<number>
  onSelect(id: number): void
  onReset(): void
  onRefresh(): void
}

export default function TestingTools({ busy, movie, pool, used, onSelect, onReset, onRefresh }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ query: string; movies?: Movie[]; error?: string }>()
  const term = query.trim()

  useEffect(() => {
    if (!open || term.length < 2) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const movies = await getJson<Movie[]>('/api/search?q=' + encodeURIComponent(term), { signal: controller.signal })
        if (!controller.signal.aborted) setResult({ query: term, movies })
      } catch (error) {
        if (!controller.signal.aborted) setResult({ query: term, error: error instanceof Error ? error.message : 'Search failed.' })
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [term, open])

  const activeResult = result?.query === term ? result : undefined
  const diagnostics = [
    ['TMDB movie ID', movie?.id],
    ['TMDB average rating', movie?.vote_average.toFixed(1)],
    ['TMDB vote count', movie?.vote_count.toLocaleString()],
    ['Original release date', movie?.release_date],
    ['Original language', movie?.original_language],
    ['Candidate pool', pool?.movies.length],
    ['Minimum vote count', pool?.threshold],
    ['Films shown this session', used.size],
  ]
  return <details className="tools" onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><FlaskConical size={17} /> <span>Testing Tools</span><ChevronDown size={17} className="chevron" /></summary>
    {open && <div className="tools-body">
      <div>
        <label htmlFor="movie-search">Find a film</label>
        <div className="search"><Search size={17} /><input id="movie-search" type="search" placeholder="Search TMDB by title…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        {term.length >= 2 && <div className="search-results" aria-live="polite">
          {!activeResult && <p>Searching…</p>}
          {activeResult?.error && <p>{activeResult.error}</p>}
          {activeResult?.movies?.length === 0 && <p>No films found.</p>}
          {activeResult?.movies?.map(item => <button key={item.id} disabled={busy || used.has(item.id)} onClick={() => onSelect(item.id)}>
            <span>{item.title}</span><small>{used.has(item.id) ? 'Already shown' : item.release_date?.slice(0, 4)}</small>
          </button>)}
        </div>}
        <div className="tool-actions">
          <button disabled={busy} onClick={onReset}><RotateCcw size={15} /> Reset Session</button>
          <button disabled={busy} onClick={onRefresh}><RefreshCw size={15} /> Refresh Pool</button>
        </div>
      </div>
      <div><h3>Diagnostics</h3><dl>{diagnostics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl></div>
    </div>}
  </details>
}
