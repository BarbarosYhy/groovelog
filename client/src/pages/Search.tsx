import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { albumsApi } from '../api/albums';
import AlbumCard from '../components/AlbumCard';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(initialQ);
  const [submitted, setSubmitted] = useState(initialQ);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const { data: albums, isLoading, isError } = useQuery({
    queryKey: ['albums-search', submitted],
    queryFn: () => albumsApi.search(submitted),
    enabled: submitted.length > 0,
    retry: false,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSubmitted(q);
    setSearchParams({ q });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-vinyl-muted pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search albums, artists…"
            className="w-full rounded-2xl border border-vinyl-border bg-vinyl-surface pl-12 pr-28 py-3.5 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none text-sm"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-vinyl-amber px-4 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors text-sm disabled:opacity-40"
          >
            Search
          </button>
        </div>
      </form>

      {isLoading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-vinyl-surface" />
          ))}
        </div>
      )}

      {albums && albums.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {albums.map((album: any) => (
            <AlbumCard key={album.spotifyAlbumId} album={album} />
          ))}
        </div>
      )}

      {albums && albums.length === 0 && (
        <div className="text-center py-20 text-vinyl-muted">
          No results for &ldquo;{submitted}&rdquo;
        </div>
      )}

      {isError && (
        <div className="rounded-xl border border-red-800/50 bg-red-900/10 p-6 text-center text-red-400 text-sm">
          Search failed. Check that the server is running.
        </div>
      )}

      {!submitted && (
        <div className="text-center py-20 text-vinyl-muted text-sm">
          Type an album or artist name to search
        </div>
      )}
    </div>
  );
}
