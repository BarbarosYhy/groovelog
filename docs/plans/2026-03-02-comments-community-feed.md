# Comments, Community Feed & Inline UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add inline expandable comments to ReviewCard, fix feed album link black screen, add comment likes, and add a Community Feed section to Discover.

**Architecture:** Four independent slices — (1) a one-line backend fix to include `spotifyAlbumId` in album cache selects; (2) a new `CommentLike` Prisma model + toggle endpoint + updated comment includes; (3) a new `GET /api/reviews/community` endpoint returning paginated album reviews; (4) a fully reworked `ReviewCard` comment section (toggle, lazy-load, inline form, comment likes) plus a New/Hot toggle section on Discover.

**Tech Stack:** Prisma 5, Express, TypeScript, React 18, TanStack Query v5, Tailwind CSS (vinyl theme)

---

## Quick Reference — Tailwind Theme

| Token | Colour |
|-------|--------|
| `vinyl-bg` | #0d0d0d |
| `vinyl-surface` | #1a1a1a |
| `vinyl-card` | #242424 |
| `vinyl-border` | #333333 |
| `vinyl-amber` | #f59e0b |
| `vinyl-amber-light` | #fbbf24 |
| `vinyl-muted` | #6b7280 |
| `vinyl-text` | #e5e7eb |

---

## Task 1: Fix feed/profile album link black screen

**Problem:** Feed and profile review queries select `albumCache: { select: { name, artist, coverUrl } }` but omit `spotifyAlbumId`. `ReviewCard` renders `<Link to={/album/${review.albumCache.spotifyAlbumId ?? ''}>`, so the link goes to `/album/` (empty string) → black screen.

**Files:**
- Modify: `server/src/routes/users.ts:143-149` (feed query albumCache select)
- Modify: `server/src/routes/users.ts:62-67` (user reviews query albumCache select)

**Step 1: Open `server/src/routes/users.ts`**

Locate `GET /:id/feed` (around line 142). The `albumCache` select looks like:

```ts
albumCache: { select: { name: true, artist: true, coverUrl: true } },
```

Add `spotifyAlbumId: true` to make it:

```ts
albumCache: { select: { spotifyAlbumId: true, name: true, artist: true, coverUrl: true } },
```

**Step 2: Fix same issue in `GET /:username/reviews`** (around line 60)

Same change — add `spotifyAlbumId: true` to the albumCache select.

**Step 3: Verify manually**

Start server (`cd server && npm run dev`). Open `/profile/yourname` or home feed. Click an album from a friend review card. Confirm it navigates to `/album/<real-id>` not a blank URL.

**Step 4: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "fix: add spotifyAlbumId to albumCache selects — feed album links now work"
```

---

## Task 2: Add CommentLike to Prisma schema

**Files:**
- Modify: `server/prisma/schema.prisma`

**Step 1: Add `CommentLike` model and update `User` + `Comment`**

In `schema.prisma`, after the `ReviewLike` model (line 86–93), add:

```prisma
model CommentLike {
  userId    String
  commentId String
  createdAt DateTime @default(now())
  user      User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  comment   Comment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  @@id([userId, commentId])
}
```

In the `User` model (around line 10), add this line inside the model body (after the existing `reviewLikes` line):

```prisma
  commentLikes        CommentLike[]
```

In the `Comment` model (around line 95), add this line inside the model body (after the `user` relation line):

```prisma
  likes     CommentLike[]
```

**Step 2: Push schema to database**

```bash
cd server && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected output ends with `✔ Generated Prisma Client`.

> **Note:** If `prisma generate` hangs saying the DLL is locked, the dev server is running. Kill it first (`taskkill /F /IM node.exe` on Windows or `kill $(lsof -ti:3001)` on Unix), then re-run the command, then restart the server.

**Step 4: Commit**

```bash
git add server/prisma/schema.prisma
git commit -m "feat(schema): add CommentLike model for comment likes"
```

---

## Task 3: Comment like endpoint + update comment includes

**Files:**
- Modify: `server/src/routes/comments.ts`
- Modify: `server/src/routes/reviews.ts:139-142` (GET /:id comments include)

**Step 1: Add `POST /api/comments/:id/like` to `comments.ts`**

Insert between the existing `router.post('/')` and `router.delete('/:id')` blocks (after line 25):

```ts
router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId: req.user!.id, commentId: req.params.id } },
    });
    if (existing) {
      await prisma.commentLike.delete({
        where: { userId_commentId: { userId: req.user!.id, commentId: req.params.id } },
      });
      res.json({ liked: false });
    } else {
      await prisma.commentLike.create({ data: { userId: req.user!.id, commentId: req.params.id } });
      res.json({ liked: true });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Update `GET /api/reviews/:id` to include comment like counts**

In `server/src/routes/reviews.ts` around line 139, the comments include currently is:

```ts
comments: {
  include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  orderBy: { createdAt: 'asc' },
},
```

Change it to:

```ts
comments: {
  include: {
    user: { select: { id: true, username: true, avatarUrl: true } },
    _count: { select: { likes: true } },
  },
  orderBy: { createdAt: 'asc' },
},
```

**Step 3: Update `POST /api/comments` response to include like count**

In `comments.ts` the create call around line 17:

```ts
const comment = await prisma.comment.create({
  data: { ...parse.data, userId: req.user!.id },
  include: { user: { select: { id: true, username: true, avatarUrl: true } } },
});
```

Change to:

```ts
const comment = await prisma.comment.create({
  data: { ...parse.data, userId: req.user!.id },
  include: {
    user: { select: { id: true, username: true, avatarUrl: true } },
    _count: { select: { likes: true } },
  },
});
```

**Step 4: Verify manually**

Start server. POST to `/api/comments/` (create a comment). The response should include `_count: { likes: 0 }`. Then POST `/api/comments/:id/like` twice — first returns `{ liked: true }`, second returns `{ liked: false }`.

**Step 5: Commit**

```bash
git add server/src/routes/comments.ts server/src/routes/reviews.ts
git commit -m "feat: comment like endpoint + include like counts in comment responses"
```

---

## Task 4: Community Feed backend endpoint

**Files:**
- Modify: `server/src/routes/reviews.ts`

**Step 1: Add `GET /community` route**

This route must be inserted BEFORE `GET /:id` (currently line 133) to prevent Express treating "community" as an id. Insert it after `GET /album/:albumId` (after line 131):

```ts
router.get('/community', async (req: AuthRequest, res: Response) => {
  const sort = (req.query.sort as string) === 'hot' ? 'hot' : 'new';
  try {
    const reviews = await prisma.review.findMany({
      where: { reviewableType: 'album' },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        albumCache: { select: { spotifyAlbumId: true, name: true, artist: true, coverUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: sort === 'hot'
        ? { likes: { _count: 'desc' } }
        : { createdAt: 'desc' },
      take: 20,
    });
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify manually**

Start server. `GET /api/reviews/community` → array of album reviews ordered newest first. `GET /api/reviews/community?sort=hot` → ordered by most-liked. Confirm each review has `albumCache.spotifyAlbumId` present (not null/undefined for album reviews).

**Step 3: Commit**

```bash
git add server/src/routes/reviews.ts
git commit -m "feat: GET /api/reviews/community endpoint with new/hot sort"
```

---

## Task 5: Frontend API client additions

**Files:**
- Create: `client/src/api/comments.ts`
- Modify: `client/src/api/reviews.ts`

**Step 1: Create `client/src/api/comments.ts`**

```ts
import { api } from './client';

export const commentsApi = {
  toggleLike: (commentId: string) =>
    api.post(`/api/comments/${commentId}/like`).then((r) => r.data as { liked: boolean }),
};
```

**Step 2: Add `getCommunity` to `client/src/api/reviews.ts`**

Append to the `reviewsApi` object (before the closing `};`):

```ts
  getCommunity: (sort: 'new' | 'hot') =>
    api.get(`/api/reviews/community?sort=${sort}`).then((r) => r.data),
```

**Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Commit**

```bash
git add client/src/api/comments.ts client/src/api/reviews.ts
git commit -m "feat: commentsApi.toggleLike + reviewsApi.getCommunity frontend clients"
```

---

## Task 6: Inline comments in ReviewCard

This is the biggest UI change. The comment count `<Link to={/review/:id}>` becomes a toggle button. When open, the card expands to show a comments panel (lazy-loaded) with per-comment like buttons and an inline post form.

**Files:**
- Modify: `client/src/components/ReviewCard.tsx`

**Step 1: Update imports and type definitions**

Replace the existing imports/interface at the top of `ReviewCard.tsx`:

```tsx
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
```

**Step 2: Replace the component body with expanded version**

Replace everything from `export default function ReviewCard(` to the closing `}` with:

```tsx
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
```

**Step 3: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors.

**Step 4: Manual test**

1. Open the app, navigate to `/` (home feed) or `/profile/:username`
2. Click the comment bubble icon on a review → panel slides in below
3. If comments exist, they show with user initial, name, date, text, like heart
4. Click the heart on a comment → count goes up, icon turns amber
5. Type a comment and click Post → comment appears in list immediately (via query invalidation)
6. "view →" link on the right still navigates to `/review/:id`

**Step 5: Commit**

```bash
git add client/src/components/ReviewCard.tsx
git commit -m "feat: inline expandable comments in ReviewCard with comment likes"
```

---

## Task 7: Community Feed section in Discover

**Files:**
- Modify: `client/src/pages/Discover.tsx`

**Step 1: Add state + query for community feed**

At the top of the `Discover` component body (after the existing queries), add:

```tsx
import { useState } from 'react';
import ReviewCard from '../components/ReviewCard';
import { reviewsApi } from '../api/reviews';

// Inside the component:
const [communitySort, setCommunitySort] = useState<'new' | 'hot'>('new');

const { data: communityReviews = [] } = useQuery({
  queryKey: ['community', communitySort],
  queryFn: () => reviewsApi.getCommunity(communitySort),
  staleTime: 2 * 60 * 1000,
});
```

Note: `useState` and `ReviewCard` need to be imported at the top of the file. `reviewsApi` is already not imported — add it.

The full updated import block for `Discover.tsx`:

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { spotifyApi } from '../api/spotify';
import { friendsApi } from '../api/friends';
import { reviewsApi } from '../api/reviews';
import HorizontalShelf from '../components/HorizontalShelf';
import ReviewCard from '../components/ReviewCard';
import { Link } from 'react-router-dom';
```

**Step 2: Add `communitySort` state and `communityReviews` query inside component**

Right after the `friendsAlbums` useMemo/map (around line 51–58), add:

```tsx
const [communitySort, setCommunitySort] = useState<'new' | 'hot'>('new');

const { data: communityReviews = [] } = useQuery({
  queryKey: ['community', communitySort],
  queryFn: () => reviewsApi.getCommunity(communitySort),
  staleTime: 2 * 60 * 1000,
});
```

**Step 3: Add Community section to the JSX**

In the Spotify-connected branch (`return (<div className="space-y-10">...`) append after the Friends' Recent Reviews shelf:

```tsx
{/* Community Feed */}
<section className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold text-vinyl-text">Community</h2>
    <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
      {(['new', 'hot'] as const).map((s) => (
        <button
          key={s}
          onClick={() => setCommunitySort(s)}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors capitalize ${
            communitySort === s
              ? 'bg-vinyl-amber text-black'
              : 'text-vinyl-muted hover:text-vinyl-text'
          }`}
        >
          {s === 'hot' ? '🔥 Hot' : '✨ New'}
        </button>
      ))}
    </div>
  </div>
  {communityReviews.length > 0 ? (
    <div className="space-y-4">
      {communityReviews.slice(0, 10).map((review: any) => (
        <ReviewCard key={review.id} review={review} showAlbum />
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-sm text-vinyl-muted">
      No reviews yet. Be the first to review an album!
    </div>
  )}
</section>
```

Also add the same Community section to the non-Spotify branch (the `return` before the Spotify prompt), after the `friendsAlbums` shelf:

```tsx
{/* Community Feed (non-Spotify view) */}
<section className="space-y-4">
  <div className="flex items-center justify-between">
    <h2 className="text-xl font-bold text-vinyl-text">Community</h2>
    <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
      {(['new', 'hot'] as const).map((s) => (
        <button
          key={s}
          onClick={() => setCommunitySort(s)}
          className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors capitalize ${
            communitySort === s
              ? 'bg-vinyl-amber text-black'
              : 'text-vinyl-muted hover:text-vinyl-text'
          }`}
        >
          {s === 'hot' ? '🔥 Hot' : '✨ New'}
        </button>
      ))}
    </div>
  </div>
  {communityReviews.length > 0 ? (
    <div className="space-y-4">
      {communityReviews.slice(0, 10).map((review: any) => (
        <ReviewCard key={review.id} review={review} showAlbum />
      ))}
    </div>
  ) : (
    <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-sm text-vinyl-muted">
      No reviews yet. Be the first to review an album!
    </div>
  )}
</section>
```

> **Tip to avoid duplication:** Since the community section is identical in both JSX branches, extract it into a `<CommunitySection>` const defined inside the component above the return, then use `{CommunitySection}` in both branches.

**Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

**Step 5: Manual test**

1. Open `/discover`
2. See "Community" section at bottom with "✨ New" and "🔥 Hot" buttons
3. Toggle between them — list reloads with different ordering
4. Each review card shows album cover + inline comments toggle
5. Works both with and without Spotify connected

**Step 6: Commit**

```bash
git add client/src/pages/Discover.tsx
git commit -m "feat: Community Feed section on Discover with New/Hot sort"
```

---

## Done

All 7 tasks complete. Run the app and verify end-to-end:

1. **Black screen fix**: Click album in feed → navigates to correct album page
2. **Inline comments**: Toggle comments on any ReviewCard anywhere in the app
3. **Comment likes**: Like individual comments inline
4. **Community Feed**: Discover shows community reviews with New/Hot toggle
