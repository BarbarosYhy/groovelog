import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { spotifyApi } from '../api/spotify';
import HorizontalShelf from '../components/HorizontalShelf';
import { Link } from 'react-router-dom';

export default function Discover() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;

  const { data: globalTop, isLoading: globalLoading, isError: globalError } = useQuery({
    queryKey: ['global-top'],
    queryFn: () => spotifyApi.getGlobalTop(),
    enabled: spotifyConnected,
    staleTime: 30 * 60 * 1000,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const topAlbums = (globalTop ?? []).slice(0, 15).map((a) => ({
    spotifyAlbumId: a.spotifyAlbumId,
    name: a.name,
    artist: a.artist,
    coverUrl: a.coverUrl,
    releaseYear: a.releaseYear,
    genres: a.genres,
  }));

  const recentAlbums = (recentlyPlayed ?? []).slice(0, 15).map((r) => ({
    spotifyAlbumId: r.albumId,
    name: r.albumName,
    artist: r.artist,
    coverUrl: r.coverUrl,
    releaseYear: 0,
    genres: [],
  }));

  // Not connected — prompt to connect
  if (!user || !spotifyConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-5 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-vinyl-text">Connect Spotify to Discover</h2>
          <p className="text-vinyl-muted text-sm mt-1">
            See your most listened albums and personal listening history.
          </p>
        </div>
        <Link
          to="/settings"
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1DB954' }}
        >
          Connect Spotify
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Your Top Albums */}
      <section>
        {globalLoading && (
          <>
            <div className="flex items-baseline gap-2 mb-4">
              <div className="h-6 w-40 rounded bg-vinyl-surface animate-pulse" />
            </div>
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-vinyl-surface" />
              ))}
            </div>
          </>
        )}

        {globalError && (
          <div className="rounded-xl border border-vinyl-border/50 bg-vinyl-surface p-6 text-center text-sm text-vinyl-muted">
            Could not load your top tracks. Try reconnecting Spotify from{' '}
            <a href="/settings" className="text-vinyl-amber underline">Settings</a>.
          </div>
        )}

        {!globalLoading && !globalError && (
          <HorizontalShelf
            albums={topAlbums}
            title="Your Top Albums"
            subtitle="· Most listened last 4 weeks"
          />
        )}
      </section>

      {/* Your Recent Plays */}
      {recentAlbums.length > 0 && (
        <HorizontalShelf
          albums={recentAlbums}
          title="Your Recent Plays"
          subtitle="· From your Spotify history"
        />
      )}
    </div>
  );
}
