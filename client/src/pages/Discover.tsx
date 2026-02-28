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
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-vinyl-text">Discover</h1>
        <p className="text-vinyl-muted mt-1">Search millions of albums from Spotify</p>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setSearch(query); }}
        className="flex gap-3"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search albums, artists..."
          className="flex-1 rounded-xl border border-vinyl-border bg-vinyl-surface px-4 py-3 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-xl bg-vinyl-amber px-6 py-3 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
        >
          Search
        </button>
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
