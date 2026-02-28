import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import { reviewsApi } from '../api/reviews';
import { listeningApi } from '../api/listening';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: album, isLoading: albumLoading } = useQuery({
    queryKey: ['album', id],
    queryFn: () => albumsApi.getById(id!),
  });

  const { data: reviews } = useQuery({
    queryKey: ['album-reviews', id],
    queryFn: () => reviewsApi.getForAlbum(id!),
    enabled: !!id,
  });

  const listenMutation = useMutation({
    mutationFn: (status: 'want' | 'listened') => listeningApi.addToList(id!, status),
  });

  if (albumLoading) return (
    <div className="animate-pulse space-y-4">
      <div className="h-64 rounded-xl bg-vinyl-surface" />
      <div className="h-8 w-48 rounded bg-vinyl-surface" />
    </div>
  );

  if (!album) return <div className="text-vinyl-muted">Album not found</div>;

  const avgDisplay = album.avgRating ? album.avgRating.toFixed(1) : '—';

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="flex flex-col gap-6 md:flex-row md:items-end">
        <div className="relative shrink-0">
          <img
            src={album.coverUrl}
            alt={album.name}
            className="h-52 w-52 rounded-2xl object-cover shadow-2xl shadow-black/60"
          />
          <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-vinyl-amber font-medium uppercase tracking-widest">Album</p>
          <h1 className="text-4xl font-bold text-vinyl-text">{album.name}</h1>
          <p className="text-xl text-vinyl-muted">{album.artist} · {album.releaseYear}</p>
          <div className="flex items-center gap-3 pt-1">
            <StarRating value={album.avgRating ?? 0} readonly size="md" />
            <span className="text-vinyl-amber font-bold text-xl">{avgDisplay}</span>
            <span className="text-vinyl-muted text-sm">({album.reviewCount} reviews)</span>
          </div>
          <div className="flex gap-3 pt-2">
            {user && (
              <Link
                to={`/review/new?albumId=${id}`}
                className="rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
              >
                Write Review
              </Link>
            )}
            <button
              onClick={() => listenMutation.mutate('want')}
              className="rounded-xl border border-vinyl-border px-5 py-2 text-sm hover:border-vinyl-amber/50 transition-colors"
            >
              Want to Listen
            </button>
            <button
              onClick={() => listenMutation.mutate('listened')}
              className="rounded-xl border border-vinyl-border px-5 py-2 text-sm hover:border-vinyl-amber/50 transition-colors"
            >
              Mark Listened
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div>
        <h2 className="text-xl font-bold text-vinyl-text mb-4">Reviews</h2>
        {reviews && reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-vinyl-muted">
            No reviews yet.{' '}
            {user && (
              <Link to={`/review/new?albumId=${id}`} className="text-vinyl-amber hover:underline">
                Be the first!
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
