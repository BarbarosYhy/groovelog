import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { reviewsApi } from '../api/reviews';
import { useAuth } from '../context/AuthContext';
import StarRating from '../components/StarRating';

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [body, setBody] = useState('');

  const { data: review, isLoading } = useQuery({
    queryKey: ['review', id],
    queryFn: () => reviewsApi.getById(id!),
    enabled: !!id,
  });

  const commentMutation = useMutation({
    mutationFn: (bodyText: string) =>
      reviewsApi.addComment({ reviewId: id!, bodyText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review', id] });
      setBody('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-vinyl-muted text-sm">
        Loading...
      </div>
    );
  }

  if (!review) {
    return (
      <div className="flex items-center justify-center py-20 text-vinyl-muted text-sm">
        Review not found.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <Link
        to={`/album/${review.reviewableId}`}
        className="inline-flex items-center gap-1.5 text-sm text-vinyl-muted hover:text-vinyl-text transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to album
      </Link>

      {/* Review body */}
      <div className="rounded-2xl border border-vinyl-border bg-vinyl-surface p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-vinyl-amber/15 flex items-center justify-center text-vinyl-amber font-bold ring-1 ring-vinyl-amber/20 shrink-0">
            {review.user.username[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link
              to={`/profile/${review.user.username}`}
              className="font-semibold text-vinyl-text hover:text-vinyl-amber transition-colors"
            >
              {review.user.username}
            </Link>
            <p className="text-xs text-vinyl-muted">
              {new Date(review.createdAt).toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
          <div className="ml-auto shrink-0">
            <StarRating value={review.rating} readonly size="sm" />
          </div>
        </div>

        {review.bodyText && (
          <p className="text-vinyl-text/90 leading-relaxed">{review.bodyText}</p>
        )}

        {review.listenDate && (
          <p className="text-xs text-vinyl-muted">
            Listened{' '}
            {new Date(review.listenDate).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>
        )}
      </div>

      {/* Comments section */}
      <div className="space-y-3">
        <h2 className="font-semibold text-vinyl-text">
          Comments{review.comments?.length ? ` (${review.comments.length})` : ''}
        </h2>

        {review.comments?.length === 0 && (
          <p className="text-sm text-vinyl-muted">No comments yet. Be the first!</p>
        )}

        {review.comments?.map((c: { id: string; bodyText: string; createdAt: string; user: { username: string } }) => (
          <div
            key={c.id}
            className="flex gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface/50 p-4"
          >
            <div className="h-8 w-8 rounded-full bg-vinyl-amber/10 flex items-center justify-center text-vinyl-amber font-bold text-xs shrink-0">
              {c.user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link
                to={`/profile/${c.user.username}`}
                className="text-sm font-medium text-vinyl-text hover:text-vinyl-amber transition-colors"
              >
                {c.user.username}
              </Link>
              <p className="text-sm text-vinyl-text/80 mt-0.5 leading-relaxed">{c.bodyText}</p>
            </div>
          </div>
        ))}

        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (body.trim()) commentMutation.mutate(body.trim());
            }}
            className="flex gap-2 pt-1"
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-xl border border-vinyl-border bg-vinyl-card px-4 py-2.5 text-sm text-vinyl-text placeholder:text-vinyl-muted focus:outline-none focus:ring-1 focus:ring-vinyl-amber/50"
            />
            <button
              type="submit"
              disabled={!body.trim() || commentMutation.isPending}
              className="px-4 py-2.5 rounded-xl bg-vinyl-amber text-black text-sm font-semibold disabled:opacity-50 hover:bg-vinyl-amber-light transition-colors"
            >
              Post
            </button>
          </form>
        ) : (
          <p className="text-sm text-vinyl-muted">
            <Link to="/login" className="text-vinyl-amber hover:underline">Log in</Link> to comment.
          </p>
        )}
      </div>
    </div>
  );
}
