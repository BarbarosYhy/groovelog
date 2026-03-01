import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { albumsApi } from '../api/albums';
import { spotifyApi } from '../api/spotify';
import ReviewCard from '../components/ReviewCard';
import AlbumCard from '../components/AlbumCard';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;

  const { data: feed, isLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user,
  });

  // If Spotify is connected, show user's recently played albums; otherwise show new releases
  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const { data: newReleases } = useQuery({
    queryKey: ['trending'],
    queryFn: () => albumsApi.getTrending(6),
    enabled: !spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  // Build the shelf data: recently played albums (max 6) or new releases
  const shelfAlbums = spotifyConnected
    ? (recentlyPlayed ?? []).slice(0, 6).map((r) => ({
        spotifyAlbumId: r.albumId,
        name: r.albumName,
        artist: '',
        coverUrl: '',
        releaseYear: 0,
        genres: [],
      }))
    : (newReleases ?? []);

  const shelfLabel = spotifyConnected ? 'Your Recent Plays' : 'New This Week';
  const shelfSub = spotifyConnected ? '· From your Spotify' : '· Fresh on Spotify';

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />)}</div>;

  return (
    <div className="space-y-6">
      {shelfAlbums.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-vinyl-text">{shelfLabel}</h2>
            <span className="text-xs text-vinyl-muted">{shelfSub}</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {shelfAlbums.map((album) => (
              <AlbumCard key={album.spotifyAlbumId} album={album} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-vinyl-text">Your Feed</h2>
        <Link to="/discover" className="text-sm text-vinyl-amber hover:underline">Discover albums →</Link>
      </div>

      {feed && feed.length > 0 ? (
        <div className="space-y-4">
          {feed.map((review: any) => <ReviewCard key={review.id} review={review} showAlbum />)}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center space-y-3">
          <span className="text-5xl">🎵</span>
          <p className="text-vinyl-text font-medium">Your feed is empty</p>
          <p className="text-vinyl-muted text-sm">Follow other users to see their reviews here.</p>
          <Link to="/discover" className="inline-block mt-2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors">
            Discover Albums
          </Link>
        </div>
      )}
    </div>
  );
}
