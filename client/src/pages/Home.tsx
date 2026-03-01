import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { albumsApi } from '../api/albums';
import ReviewCard from '../components/ReviewCard';
import AlbumCard from '../components/AlbumCard';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const { data: feed, isLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user,
  });

  const { data: trending } = useQuery({
    queryKey: ['trending'],
    queryFn: () => albumsApi.getTrending(6),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />)}</div>;

  return (
    <div className="space-y-6">
      {/* This Week — most reviewed albums in the past 7 days */}
      {trending && trending.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-bold text-vinyl-text">New This Week</h2>
            <span className="text-xs text-vinyl-muted">· Fresh on Spotify</span>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {trending.map((album: any) => (
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
