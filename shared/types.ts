export interface Movie {
  id: number
  title: string
  release_date: string
  original_language: string
  vote_average: number
  vote_count: number
  backdrop_path: string | null
  adult: boolean
}
export interface MoviePage { results: Movie[]; total_pages: number }
export interface CastMember { name: string; order: number }
export interface Credits { cast: CastMember[] }
export interface Backdrop {
  file_path: string
  width: number
  height: number
  vote_average: number
  iso_639_1: string | null
}
export interface Images { backdrops: Backdrop[] }
export interface Film {
  movie: Movie
  actors: string[]
  backdrops: string[]
}
export interface Pool { movies: Movie[]; threshold: number; refreshedAt: number }
