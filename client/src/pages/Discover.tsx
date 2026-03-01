import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { albumsApi } from '../api/albums';
import { spotifyApi } from '../api/spotify';
import AlbumCard from '../components/AlbumCard';
import { Link } from 'react-router-dom';

export default function Discover() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;

  const { data: trending, isLoading: trendingLoading } = useQuery({
    queryKey: ['trending'],
    queryFn: () => albumsApi.getTrending(10),
    staleTime: 10 * 60 * 1000,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const recentAlbums = (recentlyPlayed ?? []).slice(0, 10).map((r) => ({
    spotifyAlbumId: r.albumId,
    name: r.albumName,
    artist: r.artist,
    coverUrl: r.coverUrl,
    releaseYear: 0,
    genres: [],
  }));

  return (
    <div className="space-y-10">
      {/* Global trending */}
      <section>
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="text-xl font-black text-vinyl-text">Global New Releases</h2>
          <span className="text-xs text-vinyl-muted">· Fresh on Spotify this week</span>
        </div>

        {trendingLoading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-vinyl-surface" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {(trending ?? []).map((album: any) => (
              <AlbumCard key={album.spotifyAlbumId} album={album} />
            ))}
          </div>
        )}
      </section>

      {/* Personal recent plays — only if Spotify connected */}
      {spotifyConnected && recentAlbums.length > 0 && (
        <section>
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-xl font-black text-vinyl-text">Your Recent Plays</h2>
            <span className="text-xs text-vinyl-muted">· From your Spotify history</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {recentAlbums.map((album) => (
              <AlbumCard key={album.spotifyAlbumId} album={album} />
            ))}
          </div>
        </section>
      )}

      {/* Prompt to connect Spotify if not connected */}
      {!spotifyConnected && user && (
        <div className="rounded-xl border border-dashed border-vinyl-border p-8 text-center space-y-3">
          <p className="text-vinyl-text font-medium">See your personal listening history</p>
          <p className="text-vinyl-muted text-sm">
            Connect Spotify to see your recently played albums here.
          </p>
          <Link
            to="/settings"
            className="inline-block mt-2 rounded-xl border border-[#1DB954]/40 px-5 py-2 text-sm font-semibold text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors"
          >
            Connect Spotify →
          </Link>
        </div>
      )}
    </div>
  );
}
