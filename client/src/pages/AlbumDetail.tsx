import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import { reviewsApi } from '../api/reviews';
import { listeningApi } from '../api/listening';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function AlbumDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
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
    retry: false,
  });

  const { data: tracks } = useQuery({
    queryKey: ['album-tracks', id],
    queryFn: () => albumsApi.getTracks(id!),
    enabled: !!id,
    staleTime: 60 * 60 * 1000,
  });

  const trackIds = tracks?.map((t) => t.id) ?? [];

  const { data: myTrackRatings = {} } = useQuery({
    queryKey: ['my-track-ratings', id],
    queryFn: () => reviewsApi.getMyTrackRatings(trackIds),
    enabled: !!user && trackIds.length > 0,
  });

  const listenMutation = useMutation({
    mutationFn: (status: 'want' | 'listened') => listeningApi.addToList(id!, status),
    onSuccess: (_data, status) => setListenStatus(status),
  });

  const rateTrackMutation = useMutation({
    mutationFn: ({ trackId, rating, existingReviewId }: {
      trackId: string;
      rating: number;
      existingReviewId?: string;
    }) => existingReviewId
      ? reviewsApi.updateTrackRating(existingReviewId, rating)
      : reviewsApi.rateTrack(trackId, rating),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-track-ratings', id] });
    },
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
            <div className="flex gap-3 pt-2 flex-wrap">
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
              <a
                href={`https://open.spotify.com/album/${id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-xl border border-vinyl-border px-5 py-2 text-sm font-semibold text-vinyl-muted hover:border-[#1DB954]/60 hover:text-[#1DB954] transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
                Open in Spotify
              </a>
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

      {/* Track List */}
      {tracks && tracks.length > 0 && (
        <div>
          <h2 className="text-xl font-bold text-vinyl-text mb-3">Tracks</h2>
          <div className="rounded-xl border border-vinyl-border/50 bg-vinyl-surface overflow-hidden">
            {tracks.map((track, i) => {
              const myRating = myTrackRatings[track.id];
              return (
                <div
                  key={track.id}
                  className={`flex items-center gap-4 px-4 py-2.5 hover:bg-vinyl-card/50 transition-colors ${
                    i < tracks.length - 1 ? 'border-b border-vinyl-border/30' : ''
                  }`}
                >
                  {/* Track number */}
                  <span className="w-6 text-right text-xs text-vinyl-muted shrink-0">
                    {track.trackNumber}
                  </span>
                  {/* Album art (small) */}
                  <img
                    src={album.coverUrl}
                    alt=""
                    className="w-8 h-8 rounded object-cover shrink-0 opacity-70"
                  />
                  {/* Track name */}
                  <span className="flex-1 text-sm text-vinyl-text truncate">{track.name}</span>
                  {/* Duration */}
                  <span className="text-xs text-vinyl-muted shrink-0">
                    {formatDuration(track.durationMs)}
                  </span>
                  {/* Star rating */}
                  {user && (
                    <div className="shrink-0">
                      <StarRating
                        value={myRating?.rating ?? 0}
                        size="sm"
                        onChange={(rating) =>
                          rateTrackMutation.mutate({
                            trackId: track.id,
                            rating,
                            existingReviewId: myRating?.reviewId,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {user && (
            <p className="text-xs text-vinyl-muted mt-2 text-right">
              Hover stars to rate individual tracks
            </p>
          )}
        </div>
      )}

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
