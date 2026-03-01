import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { spotifyApi } from '../api/spotify';
import ReviewCard from '../components/ReviewCard';
import HorizontalShelf from '../components/HorizontalShelf';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;

  const { data: feed, isLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const recentAlbums = (recentlyPlayed ?? []).slice(0, 15).map((r) => ({
    spotifyAlbumId: r.albumId,
    name: r.albumName,
    artist: r.artist,
    coverUrl: r.coverUrl,
    releaseYear: 0,
    genres: [],
  }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Recent Plays — only shown when Spotify is connected */}
      {spotifyConnected && recentAlbums.length > 0 && (
        <HorizontalShelf
          albums={recentAlbums}
          title="Your Recent Plays"
          subtitle="· From your Spotify"
        />
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-vinyl-text">Your Feed</h2>
        <Link to="/discover" className="text-sm text-vinyl-amber hover:underline">
          Discover albums →
        </Link>
      </div>

      {feed && feed.length > 0 ? (
        <div className="space-y-4">
          {feed.map((review: any) => (
            <ReviewCard key={review.id} review={review} showAlbum />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center space-y-3">
          <span className="text-5xl block">🎵</span>
          <p className="text-vinyl-text font-medium">Your feed is empty</p>
          <p className="text-vinyl-muted text-sm">
            Add friends to see their reviews here.
          </p>
          <Link
            to="/friends"
            className="inline-block mt-2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
          >
            Find Friends
          </Link>
        </div>
      )}
    </div>
  );
}
