import { useState } from 'react';
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
  const [listenStatus, setListenStatus] = useState<'want' | 'listened' | null>(null);

  const { data: album, isLoading: albumLoading } = useQuery({
    queryKey: ['album', id],
    queryFn: () => albumsApi.getById(id!),
  });

  const { data: reviews } = useQuery({
    queryKey: ['album-reviews', id],
    queryFn: () => reviewsApi.getForAlbum(id!),
    enabled: !!id,
  });

  const { data: myReview } = useQuery({
    queryKey: ['my-review', id],
    queryFn: () => reviewsApi.getMyReview(id!),
    enabled: !!user && !!id,
    retry: false, // 404 is expected if no review
  });

  const listenMutation = useMutation({
    mutationFn: (status: 'want' | 'listened') => listeningApi.addToList(id!, status),
    onSuccess: (_data, status) => setListenStatus(status),
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
      {/* Hero with blurred background */}
      <div className="relative -mx-4 -mt-8 mb-8 overflow-hidden rounded-b-2xl">
        {/* Blurred album art background */}
        <div
          className="absolute inset-0 scale-110"
          style={{
            backgroundImage: `url(${album.coverUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(40px)',
            opacity: 0.25,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-vinyl-bg/30 via-vinyl-bg/70 to-vinyl-bg" />

        {/* Content over gradient */}
        <div className="relative flex flex-col gap-6 px-6 pt-12 pb-8 md:flex-row md:items-end">
          <div className="relative shrink-0">
            <img
              src={album.coverUrl}
              alt={album.name}
              className="h-52 w-52 rounded-2xl object-cover shadow-2xl shadow-black/80 ring-1 ring-white/10"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-widest text-vinyl-amber">Album</p>
            <h1 className="text-4xl font-black text-white leading-tight">{album.name}</h1>
            <p className="text-lg text-white/60">{album.artist} · {album.releaseYear}</p>
            <div className="flex items-center gap-3 pt-1">
              <StarRating value={album.avgRating ?? 0} readonly size="md" />
              <span className="text-vinyl-amber font-bold text-xl">{avgDisplay}</span>
              <span className="text-white/40 text-sm">({album.reviewCount} reviews)</span>
            </div>
            <div className="flex gap-3 pt-2">
              {user && (
                myReview ? (
                  <Link
                    to={`/review/new?albumId=${id}&reviewId=${myReview.id}`}
                    className="rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
                  >
                    Edit Review
                  </Link>
                ) : (
                  <Link
                    to={`/review/new?albumId=${id}`}
                    className="rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
                  >
                    Write Review
                  </Link>
                )
              )}
            </div>
            <div className="pt-2">
              {user ? (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => listenMutation.mutate('want')}
                    disabled={listenMutation.isPending}
                    className={`rounded-xl border px-5 py-2 text-sm transition-colors disabled:opacity-50 ${
                      listenStatus === 'want'
                        ? 'border-vinyl-amber bg-vinyl-amber/10 text-vinyl-amber'
                        : 'border-vinyl-border hover:border-vinyl-amber/50 text-vinyl-muted hover:text-vinyl-text'
                    }`}
                  >
                    {listenStatus === 'want' ? '✓ Want to Listen' : 'Want to Listen'}
                  </button>
                  <button
                    onClick={() => listenMutation.mutate('listened')}
                    disabled={listenMutation.isPending}
                    className={`rounded-xl border px-5 py-2 text-sm transition-colors disabled:opacity-50 ${
                      listenStatus === 'listened'
                        ? 'border-vinyl-amber bg-vinyl-amber/10 text-vinyl-amber'
                        : 'border-vinyl-border hover:border-vinyl-amber/50 text-vinyl-muted hover:text-vinyl-text'
                    }`}
                  >
                    {listenStatus === 'listened' ? '✓ Listened' : 'Mark Listened'}
                  </button>
                </div>
              ) : (
                <p className="text-sm text-vinyl-muted">
                  <Link to="/login" className="text-vinyl-amber hover:underline">Log in</Link>{' '}
                  to track this album
                </p>
              )}
              {listenMutation.isError && (
                <p className="text-sm text-red-400 mt-2">Failed to update list. Try again.</p>
              )}
            </div>
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
