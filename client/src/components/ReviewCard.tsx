import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { reviewsApi } from '../api/reviews';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

interface Review {
  id: string;
  rating: number;
  bodyText?: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl?: string };
  _count?: { likes: number; comments: number };
  albumCache?: { name: string; artist: string; coverUrl: string };
}

export default function ReviewCard({ review, showAlbum = false }: { review: Review; showAlbum?: boolean }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);

  async function handleLike() {
    if (!user) return;
    const res = await reviewsApi.toggleLike(review.id);
    setLiked(res.liked);
  }

  return (
    <article className="rounded-xl border border-vinyl-border bg-vinyl-surface p-4 space-y-3">
      {showAlbum && review.albumCache && (
        <div className="flex items-center gap-3 pb-2 border-b border-vinyl-border">
          <img src={review.albumCache.coverUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          <div>
            <p className="font-medium text-vinyl-text">{review.albumCache.name}</p>
            <p className="text-sm text-vinyl-muted">{review.albumCache.artist}</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber font-bold text-sm">
            {review.user.username[0].toUpperCase()}
          </div>
          <div>
            <Link to={`/profile/${review.user.username}`} className="text-sm font-medium hover:text-vinyl-amber transition-colors">
              {review.user.username}
            </Link>
            <p className="text-xs text-vinyl-muted">{new Date(review.createdAt).toLocaleDateString()}</p>
          </div>
        </div>
        <StarRating value={review.rating} readonly size="sm" />
      </div>

      {review.bodyText && (
        <p className="text-sm text-vinyl-text leading-relaxed line-clamp-4">{review.bodyText}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-vinyl-muted pt-1">
        <button onClick={handleLike} className={`flex items-center gap-1 hover:text-vinyl-amber transition-colors ${liked ? 'text-vinyl-amber' : ''}`}>
          ♥ {(review._count?.likes ?? 0) + (liked ? 1 : 0)}
        </button>
        <Link to={`/review/${review.id}`} className="flex items-center gap-1 hover:text-vinyl-text transition-colors">
          💬 {review._count?.comments ?? 0}
        </Link>
      </div>
    </article>
  );
}
