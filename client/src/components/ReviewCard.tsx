import { Link } from 'react-router-dom';
import StarRating from './StarRating';
import { reviewsApi } from '../api/reviews';
import { commentsApi } from '../api/comments';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface Comment {
  id: string;
  bodyText: string;
  createdAt: string;
  user: { id: string; username: string };
  _count?: { likes: number };
}

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
  const qc = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review._count?.likes ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentLikes, setCommentLikes] = useState<Record<string, { liked: boolean; count: number }>>({});

  // Lazy-load comments only when panel is opened
  const { data: fullReview } = useQuery({
    queryKey: ['review', review.id],
    queryFn: () => reviewsApi.getById(review.id),
    enabled: commentsOpen,
    staleTime: 30_000,
  });

  const comments: Comment[] = fullReview?.comments ?? [];

  const postCommentMutation = useMutation({
    mutationFn: (bodyText: string) => reviewsApi.addComment({ reviewId: review.id, bodyText }),
    onSuccess: () => {
      setCommentText('');
      qc.invalidateQueries({ queryKey: ['review', review.id] });
    },
  });

  async function handleLike() {
    if (!user) return;
    const res = await reviewsApi.toggleLike(review.id);
    setLiked(res.liked);
    setLikeCount((c) => c + (res.liked ? 1 : -1));
  }

  function handleCommentLike(commentId: string, currentCount: number, currentLiked: boolean) {
    if (!user) return;
    const next = !currentLiked;
    setCommentLikes((prev) => ({
      ...prev,
      [commentId]: { liked: next, count: currentCount + (next ? 1 : -1) },
    }));
    commentsApi.toggleLike(commentId);
  }

  const commentCount = fullReview ? comments.length : (review._count?.comments ?? 0);

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
          <button
            onClick={() => setCommentsOpen((o) => !o)}
            className={`flex items-center gap-1.5 text-xs transition-colors ${
              commentsOpen ? 'text-vinyl-text' : 'text-vinyl-muted hover:text-vinyl-text'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {commentCount}
          </button>
          <Link
            to={`/review/${review.id}`}
            className="ml-auto text-xs text-vinyl-muted hover:text-vinyl-text transition-colors"
          >
            view →
          </Link>
        </div>
      </div>

      {/* Inline comments panel */}
      {commentsOpen && (
        <div className="border-t border-vinyl-border/40 bg-vinyl-card/40 px-4 py-3 space-y-3">
          {comments.length === 0 && !fullReview && (
            <p className="text-xs text-vinyl-muted animate-pulse">Loading…</p>
          )}
          {comments.length === 0 && fullReview && (
            <p className="text-xs text-vinyl-muted">No comments yet. Be the first!</p>
          )}
          {comments.map((c) => {
            const cl = commentLikes[c.id] ?? { liked: false, count: c._count?.likes ?? 0 };
            return (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-vinyl-amber/10 flex items-center justify-center text-vinyl-amber text-xs font-bold shrink-0 mt-0.5">
                  {c.user.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <Link
                      to={`/profile/${c.user.username}`}
                      className="text-xs font-semibold text-vinyl-text hover:text-vinyl-amber transition-colors"
                    >
                      {c.user.username}
                    </Link>
                    <span className="text-[10px] text-vinyl-muted">
                      {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-xs text-vinyl-text/80 leading-relaxed mt-0.5">{c.bodyText}</p>
                  <button
                    onClick={() => handleCommentLike(c.id, cl.count, cl.liked)}
                    className={`flex items-center gap-1 mt-1 text-[10px] transition-colors ${
                      cl.liked ? 'text-vinyl-amber' : 'text-vinyl-muted hover:text-vinyl-amber'
                    }`}
                  >
                    <svg className="w-3 h-3" viewBox="0 0 20 20" fill={cl.liked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                    </svg>
                    {cl.count > 0 && cl.count}
                  </button>
                </div>
              </div>
            );
          })}

          {user && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (commentText.trim()) postCommentMutation.mutate(commentText.trim());
              }}
              className="flex gap-2 pt-1"
            >
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a comment…"
                className="flex-1 rounded-lg border border-vinyl-border bg-vinyl-surface px-3 py-1.5 text-xs text-vinyl-text placeholder-vinyl-muted focus:outline-none focus:border-vinyl-amber/60 transition-colors"
              />
              <button
                type="submit"
                disabled={!commentText.trim() || postCommentMutation.isPending}
                className="rounded-lg bg-vinyl-amber px-3 py-1.5 text-xs font-semibold text-black hover:bg-vinyl-amber-light transition-colors disabled:opacity-50"
              >
                Post
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}
