import { useState, useEffect, FormEvent } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { albumsApi } from '../api/albums';
import { reviewsApi } from '../api/reviews';
import { spotifyApi } from '../api/spotify';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';

export default function WriteReview() {
  const [searchParams] = useSearchParams();
  const albumId = searchParams.get('albumId') ?? '';
  const reviewId = searchParams.get('reviewId') ?? '';
  const isEditing = !!reviewId;
  const navigate = useNavigate();

  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;
  const [fetchingSpotify, setFetchingSpotify] = useState(false);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [listenDate, setListenDate] = useState('');
  const [error, setError] = useState('');

  const { data: album } = useQuery({
    queryKey: ['album', albumId],
    queryFn: () => albumsApi.getById(albumId),
    enabled: !!albumId,
  });

  const { data: existingReview } = useQuery({
    queryKey: ['review', reviewId],
    queryFn: () => reviewsApi.getById(reviewId),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingReview) {
      setRating(existingReview.rating);
      setBody(existingReview.bodyText ?? '');
      setListenDate(
        existingReview.listenDate
          ? new Date(existingReview.listenDate).toISOString().slice(0, 10)
          : ''
      );
    }
  }, [existingReview]);

  const mutation = useMutation({
    mutationFn: () =>
      isEditing
        ? reviewsApi.update(reviewId, {
            rating,
            bodyText: body || undefined,
            listenDate: listenDate ? new Date(listenDate).toISOString() : undefined,
          })
        : reviewsApi.create({
            reviewableType: 'album',
            reviewableId: albumId,
            rating,
            bodyText: body || undefined,
            listenDate: listenDate ? new Date(listenDate).toISOString() : undefined,
          }),
    onSuccess: () => navigate(`/album/${albumId}`),
    onError: (err: unknown) => {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to submit');
    },
  });

  async function fetchListenDate() {
    if (!albumId) return;
    setFetchingSpotify(true);
    try {
      const history = await spotifyApi.getRecentlyPlayed();
      const match = history.find((item) => item.albumId === albumId);
      if (match) {
        setListenDate(new Date(match.playedAt).toISOString().slice(0, 10));
      }
    } catch {
      // silently fail — user can set date manually
    } finally {
      setFetchingSpotify(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-vinyl-text">
        {isEditing ? 'Edit Review' : 'Write a Review'}
      </h1>

      {album && (
        <div className="flex items-center gap-4 rounded-xl border border-vinyl-border bg-vinyl-surface p-4">
          <img src={album.coverUrl} alt={album.name} className="h-16 w-16 rounded-lg object-cover" />
          <div>
            <p className="font-semibold text-vinyl-text">{album.name}</p>
            <p className="text-sm text-vinyl-muted">{album.artist} · {album.releaseYear}</p>
          </div>
        </div>
      )}

      <form onSubmit={(e: FormEvent) => {
        e.preventDefault();
        if (rating === 0) { setError('Please select a rating'); return; }
        mutation.mutate();
      }} className="space-y-5">
        {error && <div className="rounded-lg bg-red-900/30 border border-red-800 p-3 text-sm text-red-300">{error}</div>}

        <div>
          <label className="block text-sm font-medium text-vinyl-muted mb-2">Rating</label>
          <StarRating value={rating} onChange={setRating} size="lg" />
          {rating > 0 && <span className="mt-1 block text-sm text-vinyl-amber">{rating} / 5</span>}
        </div>

        <div>
          <label className="block text-sm font-medium text-vinyl-muted mb-2">Review (optional)</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder="What did you think?"
            className="w-full rounded-xl border border-vinyl-border bg-vinyl-surface px-4 py-3 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none resize-none"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-vinyl-muted">Listen date (optional)</label>
            {spotifyConnected && (
              <button
                type="button"
                onClick={fetchListenDate}
                disabled={fetchingSpotify}
                className="text-xs text-[#1DB954] hover:underline disabled:opacity-50 transition-opacity"
              >
                {fetchingSpotify ? 'Fetching...' : '↑ Fetch from Spotify'}
              </button>
            )}
          </div>
          <input
            type="date"
            value={listenDate}
            onChange={(e) => setListenDate(e.target.value)}
            className="rounded-xl border border-vinyl-border bg-vinyl-surface px-4 py-2.5 text-vinyl-text focus:border-vinyl-amber focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-xl bg-vinyl-amber py-3 font-semibold text-black hover:bg-vinyl-amber-light disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? 'Submitting...' : isEditing ? 'Update Review' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
}
