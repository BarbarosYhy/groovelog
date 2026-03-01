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
  albumCache?: { spotifyAlbumId?: string; name: string; artist: string; coverUrl: string };
}

export default function ReviewCard({ review, showAlbum = false }: { review: Review; showAlbum?: boolean }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review._count?.likes ?? 0);

  async function handleLike() {
    if (!user) return;
    const res = await reviewsApi.toggleLike(review.id);
    setLiked(res.liked);
    setLikeCount((c) => c + (res.liked ? 1 : -1));
  }

  return (
    <article className="group rounded-2xl border border-vinyl-border/60 bg-vinyl-surface hover:border-vinyl-border transition-colors overflow-hidden">
      {showAlbum && review.albumCache && (
        <Link
          to={`/album/${review.albumCache.spotifyAlbumId ?? ''}`}
          className="flex items-center gap-4 p-4 border-b border-vinyl-border/40 hover:bg-vinyl-card/50 transition-colors"
        >
          <img
            src={review.albumCache.coverUrl}
            alt=""
            className="h-14 w-14 rounded-lg object-cover shadow-md shrink-0"
          />
          <div>
            <p className="font-semibold text-vinyl-text text-sm">{review.albumCache.name}</p>
            <p className="text-xs text-vinyl-muted mt-0.5">{review.albumCache.artist}</p>
          </div>
        </Link>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/profile/${review.user.username}`} className="flex items-center gap-2.5 group/user min-w-0">
            <div className="h-9 w-9 rounded-full bg-vinyl-amber/15 flex items-center justify-center text-vinyl-amber font-bold text-sm ring-1 ring-vinyl-amber/20 shrink-0">
              {review.user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-vinyl-text group-hover/user:text-vinyl-amber transition-colors leading-tight truncate">
                {review.user.username}
              </p>
              <p className="text-xs text-vinyl-muted">
                {new Date(review.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </Link>
          <StarRating value={review.rating} readonly size="sm" />
        </div>

        {review.bodyText && (
          <p className="text-sm text-vinyl-text/90 leading-relaxed line-clamp-4">{review.bodyText}</p>
        )}

        <div className="flex items-center gap-4 pt-1 border-t border-vinyl-border/30">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              liked ? 'text-vinyl-amber' : 'text-vinyl-muted hover:text-vinyl-amber'
            }`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
            </svg>
            {likeCount}
          </button>
          <Link
            to={`/review/${review.id}`}
            className="flex items-center gap-1.5 text-xs text-vinyl-muted hover:text-vinyl-text transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {review._count?.comments ?? 0}
          </Link>
        </div>
      </div>
    </article>
  );
}
