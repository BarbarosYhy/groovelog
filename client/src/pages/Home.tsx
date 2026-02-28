import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import ReviewCard from '../components/ReviewCard';
import { Link } from 'react-router-dom';

export default function Home() {
  const { user } = useAuth();
  const { data: feed, isLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user,
  });

  if (isLoading) return <div className="space-y-4">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />)}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-vinyl-text">Your Feed</h1>
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
