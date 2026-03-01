import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import AlbumCard from '../components/AlbumCard';

export default function Discover() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');

  const { data: albums, isLoading, isError } = useQuery({
    queryKey: ['albums-search', search],
    queryFn: () => albumsApi.search(search),
    enabled: search.length > 0,
    retry: false,
  });

  return (
    <div className="space-y-8">
      {/* Hero search */}
      <div className="text-center space-y-4 py-8">
        <h1 className="text-4xl font-black text-vinyl-text">Discover</h1>
        <p className="text-vinyl-muted">Search millions of albums from Spotify</p>
        <form
          onSubmit={(e) => { e.preventDefault(); setSearch(query); }}
          className="max-w-xl mx-auto"
        >
          <div className="relative">
            <svg
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-vinyl-muted pointer-events-none"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search albums, artists..."
              className="w-full rounded-2xl border border-vinyl-border bg-vinyl-surface pl-12 pr-32 py-4 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none text-base"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors text-sm"
            >
              Search
            </button>
          </div>
        </form>
      </div>

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

      {isError && (
        <div className="rounded-xl border border-red-800 bg-red-900/20 p-6 text-center text-red-300">
          Search failed. Check that the server is running and Spotify credentials are set.
        </div>
      )}

      {albums && albums.length === 0 && (
        <div className="text-center py-16 text-vinyl-muted">No results for "{search}"</div>
      )}

      {!search && (
        <div className="text-center py-16 text-vinyl-muted">
          <span className="text-6xl block mb-4">🎵</span>
          <p>Search for any album to get started</p>
        </div>
      )}
    </div>
  );
}
