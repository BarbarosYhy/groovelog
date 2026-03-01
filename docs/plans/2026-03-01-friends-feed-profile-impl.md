# Friends Page, Feed & Profile Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Friends page, fix the friends-based feed, fix profile recent reviews, fix track star rating clicks, and add three bonus features (nav badge, profile stats, friends shelf on Discover).

**Architecture:** Backend-first per task (new Express endpoints), then matching frontend API client additions, then UI. All changes are additive — no schema migrations needed. Server runs on port 3001, client on 5173.

**Tech Stack:** Express + TypeScript + Prisma (server), React 18 + Vite + TypeScript + TailwindCSS + TanStack Query (client)

---

## Task 0: Reset User Data

**Files:**
- Run commands in `server/` directory

**Step 1: Run Prisma delete cascade in order**

```bash
cd server && npx ts-node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  await p.reviewLike.deleteMany();
  await p.comment.deleteMany();
  await p.review.deleteMany();
  await p.listeningList.deleteMany();
  await p.listenLog.deleteMany();
  await p.playlistItem.deleteMany();
  await p.playlist.deleteMany();
  await p.friendship.deleteMany();
  await p.follow.deleteMany();
  await p.user.deleteMany();
  console.log('Done');
  await p.\$disconnect();
}
main();
"
```

Expected output: `Done`

**Step 2: Verify in psql (optional)**

```bash
docker exec -it $(docker ps -q) psql -U albumuser -d albumreview -c "SELECT COUNT(*) FROM \"User\";"
```

Expected: `count = 0`

---

## Task 1: Fix Track Star Rating Click

**Files:**
- Modify: `client/src/components/StarRating.tsx:24`

**Step 1: Apply the fix**

In `StarRating.tsx`, find the amber overlay span (line ~24) and add `pointer-events-none`:

```tsx
{(full || half) && (
  <span
    className="absolute inset-0 overflow-hidden text-vinyl-amber pointer-events-none"
    style={{ width: half ? '50%' : '100%' }}
  >
    ★
  </span>
)}
```

**Step 2: Verify**

Start both servers. Go to any album page (e.g. `/album/someId`), hover a track row — stars appear. Click a star — it should register and turn amber. Click another half-star — updates to 0.5. Confirmed working.

**Step 3: Commit**

```bash
git add client/src/components/StarRating.tsx
git commit -m "fix: track star rating click blocked by overlay span"
```

---

## Task 2: Backend — User Search Endpoint

**Files:**
- Modify: `server/src/routes/users.ts` (add before line 7, i.e. before any `/:username` route)

**Step 1: Add `/search` route at the very top of the router**

Insert this block as the FIRST route in `users.ts` (before `/:username/want-list`):

```ts
router.get('/search', requireAuth, async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string ?? '').trim();
  if (q.length < 2) { res.json([]); return; }
  try {
    const users = await prisma.user.findMany({
      where: {
        username: { contains: q, mode: 'insensitive' },
        NOT: { id: req.user!.id },
      },
      select: { id: true, username: true, avatarUrl: true },
      take: 10,
    });
    res.json(users);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

Also add `requireAuth` to the import at top — it's already imported.

**Step 2: Verify**

```bash
# In server/ directory, server must be running
curl -H "Authorization: Bearer <your-jwt>" "http://localhost:3001/api/users/search?q=test"
```

Expected: `[]` or array of users matching "test".

**Step 3: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "feat: add user search endpoint GET /api/users/search"
```

---

## Task 3: Backend — User Reviews Endpoint

**Files:**
- Modify: `server/src/routes/users.ts` (add after want-list route, before `/:username`)

**Step 1: Add `/:username/reviews` route**

Insert this block after the `/:username/want-list` route and before `/:username`:

```ts
router.get('/:username/reviews', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const reviews = await prisma.review.findMany({
      where: { userId: user.id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        albumCache: { select: { name: true, artist: true, coverUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify**

```bash
curl "http://localhost:3001/api/users/<someusername>/reviews"
```

Expected: array of reviews (may be empty if no reviews yet).

**Step 3: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "feat: add user reviews endpoint GET /api/users/:username/reviews"
```

---

## Task 4: Backend — Extend Profile Endpoint with Stats

**Files:**
- Modify: `server/src/routes/users.ts` — the `/:username` GET route

**Step 1: Replace the `/:username` handler body**

Find the existing `router.get('/:username', ...)` route and replace its body:

```ts
router.get('/:username', async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true, username: true, bio: true, avatarUrl: true, createdAt: true,
        _count: { select: { reviews: true, followers: true, following: true } },
      },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const [avgRatingResult, friendCount] = await Promise.all([
      prisma.review.aggregate({
        where: { userId: user.id, reviewableType: 'album', rating: { not: null } },
        _avg: { rating: true },
      }),
      prisma.friendship.count({
        where: {
          status: 'accepted',
          OR: [{ requesterId: user.id }, { addresseeId: user.id }],
        },
      }),
    ]);

    res.json({
      ...user,
      avgRating: avgRatingResult._avg.rating,
      friendCount,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify**

```bash
curl "http://localhost:3001/api/users/<someusername>"
```

Expected: user object now includes `avgRating` (number or null) and `friendCount` (number).

**Step 3: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "feat: add avgRating and friendCount to profile endpoint"
```

---

## Task 5: Backend — Feed Changes to Friends-Based

**Files:**
- Modify: `server/src/routes/users.ts` — the `/:id/feed` GET route

**Step 1: Replace feed handler body**

Find `router.get('/:id/feed', ...)` and replace its inner try block:

```ts
router.get('/:id/feed', requireAuth, async (req: AuthRequest, res: Response) => {
  if (req.params.id !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: req.user!.id }, { addresseeId: req.user!.id }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === req.user!.id ? f.addresseeId : f.requesterId
    );
    const reviews = await prisma.review.findMany({
      where: { userId: { in: friendIds } },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        albumCache: { select: { name: true, artist: true, coverUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify**

```bash
curl -H "Authorization: Bearer <jwt>" "http://localhost:3001/api/users/<userId>/feed"
```

Expected: empty array if no friends, or friends' reviews if any.

**Step 3: Commit**

```bash
git add server/src/routes/users.ts
git commit -m "feat: change feed to show friends reviews (mutual friendships)"
```

---

## Task 6: Backend — Friends Recent Reviews Endpoint

**Files:**
- Modify: `server/src/routes/friends.ts` (add before the closing `export default router`)

**Step 1: Add `GET /recent-reviews` route**

Insert before `export default router`:

```ts
// Get albums recently reviewed by friends (for Discover shelf)
router.get('/recent-reviews', requireAuth, async (req: AuthRequest, res: Response) => {
  const myId = req.user!.id;
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: myId }, { addresseeId: myId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = friendships.map((f) =>
      f.requesterId === myId ? f.addresseeId : f.requesterId
    );
    if (friendIds.length === 0) { res.json([]); return; }

    const reviews = await prisma.review.findMany({
      where: { userId: { in: friendIds }, reviewableType: 'album' },
      include: { albumCache: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    const seen = new Set<string>();
    const albums: object[] = [];
    for (const r of reviews) {
      if (!seen.has(r.reviewableId) && r.albumCache) {
        seen.add(r.reviewableId);
        albums.push({
          spotifyAlbumId: r.reviewableId,
          name: r.albumCache.name,
          artist: r.albumCache.artist,
          coverUrl: r.albumCache.coverUrl,
          releaseYear: r.albumCache.releaseYear,
          genres: r.albumCache.genres,
        });
        if (albums.length >= 15) break;
      }
    }
    res.json(albums);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify**

```bash
curl -H "Authorization: Bearer <jwt>" "http://localhost:3001/api/friends/recent-reviews"
```

Expected: `[]` or array of album objects.

**Step 3: Commit**

```bash
git add server/src/routes/friends.ts
git commit -m "feat: add GET /api/friends/recent-reviews for Discover shelf"
```

---

## Task 7: Frontend — Update API Clients

**Files:**
- Modify: `client/src/api/users.ts`
- Modify: `client/src/api/friends.ts`

**Step 1: Add `search` and `getReviews` to `users.ts`**

Replace the entire file content:

```ts
import { api } from './client';

export const usersApi = {
  getProfile: (username: string) =>
    api.get(`/api/users/${username}`).then((r) => r.data),
  toggleFollow: (id: string) =>
    api.post(`/api/users/${id}/follow`).then((r) => r.data),
  getFeed: (userId: string) =>
    api.get(`/api/users/${userId}/feed`).then((r) => r.data),
  getWantList: (username: string) =>
    api.get(`/api/users/${username}/want-list`).then((r) => r.data as Array<{
      spotifyAlbumId: string;
      name: string;
      artist: string;
      coverUrl: string;
      releaseYear: number;
      addedAt: string;
    }>),
  search: (q: string) =>
    api.get(`/api/users/search?q=${encodeURIComponent(q)}`).then((r) => r.data as Array<{
      id: string;
      username: string;
      avatarUrl: string | null;
    }>),
  getReviews: (username: string) =>
    api.get(`/api/users/${username}/reviews`).then((r) => r.data),
};
```

**Step 2: Add `getRecentReviews` to `friends.ts`**

Replace the entire file content:

```ts
import { api } from './client';

export const friendsApi = {
  getStatus: (userId: string) =>
    api.get(`/api/friends/status/${userId}`).then((r) => r.data as {
      status: 'self' | 'none' | 'friends' | 'pending_sent' | 'pending_received';
      friendshipId?: string;
    }),
  getFriends: () =>
    api.get('/api/friends').then((r) => r.data as Array<{
      id: string;
      username: string;
      avatarUrl: string | null;
    }>),
  getRequests: () =>
    api.get('/api/friends/requests').then((r) => r.data as Array<{
      friendshipId: string;
      id: string;
      username: string;
      avatarUrl: string | null;
      createdAt: string;
    }>),
  sendRequest: (userId: string) =>
    api.post(`/api/friends/request/${userId}`).then((r) => r.data),
  accept: (friendshipId: string) =>
    api.post(`/api/friends/accept/${friendshipId}`).then((r) => r.data),
  remove: (userId: string) =>
    api.delete(`/api/friends/${userId}`).then((r) => r.data),
  getRecentReviews: () =>
    api.get('/api/friends/recent-reviews').then((r) => r.data as Array<{
      spotifyAlbumId: string;
      name: string;
      artist: string;
      coverUrl: string;
      releaseYear: number;
      genres: string[];
    }>),
};
```

**Step 3: Commit**

```bash
git add client/src/api/users.ts client/src/api/friends.ts
git commit -m "feat: add search, getReviews, getRecentReviews API client methods"
```

---

## Task 8: Frontend — Friends Page

**Files:**
- Create: `client/src/pages/Friends.tsx`

**Step 1: Create the file**

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendsApi } from '../api/friends';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';

function Avatar({ username }: { username: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber text-sm font-bold shrink-0">
      {username[0].toUpperCase()}
    </div>
  );
}

export default function Friends() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.getFriends(),
    enabled: !!me,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsApi.getRequests(),
    enabled: !!me,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', searchQ],
    queryFn: () => usersApi.search(searchQ),
    enabled: searchQ.length >= 2,
  });

  const sendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.sendRequest(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['user-search', searchQ] }),
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) => friendsApi.accept(friendshipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQ(input.trim());
  };

  return (
    <div className="space-y-10 max-w-xl">
      <h1 className="text-2xl font-bold text-vinyl-text">Friends</h1>

      {/* Search */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-vinyl-text">Find People</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by username..."
            className="flex-1 rounded-xl border border-vinyl-border bg-vinyl-surface px-4 py-2 text-sm text-vinyl-text placeholder-vinyl-muted focus:outline-none focus:border-vinyl-amber/60 transition-colors"
          />
          <button
            type="submit"
            className="rounded-xl bg-vinyl-amber px-4 py-2 text-sm font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
          >
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={u.username} />
                <Link
                  to={`/profile/${u.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {u.username}
                </Link>
                <button
                  onClick={() => sendMutation.mutate(u.id)}
                  disabled={sendMutation.isPending}
                  className="rounded-xl border border-vinyl-border px-3 py-1.5 text-xs text-vinyl-muted hover:border-vinyl-amber/60 hover:text-vinyl-text transition-colors disabled:opacity-50"
                >
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQ.length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-vinyl-muted">No users found for "{searchQ}".</p>
        )}
      </section>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-vinyl-text">
            Requests{' '}
            <span className="text-vinyl-amber text-sm">({requests.length})</span>
          </h2>
          <div className="space-y-2">
            {requests.map((r: any) => (
              <div
                key={r.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={r.username} />
                <Link
                  to={`/profile/${r.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {r.username}
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptMutation.mutate(r.friendshipId)}
                    disabled={acceptMutation.isPending}
                    className="rounded-xl bg-vinyl-amber px-3 py-1.5 text-xs font-semibold text-black hover:bg-vinyl-amber-light transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(r.id)}
                    disabled={removeMutation.isPending}
                    className="rounded-xl border border-vinyl-border px-3 py-1.5 text-xs text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-vinyl-text">
          Friends{' '}
          <span className="text-vinyl-muted text-sm">({friends.length})</span>
        </h2>
        {friends.length > 0 ? (
          <div className="space-y-2">
            {friends.map((f: any) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={f.username} />
                <Link
                  to={`/profile/${f.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {f.username}
                </Link>
                <button
                  onClick={() => removeMutation.mutate(f.id)}
                  disabled={removeMutation.isPending}
                  className="rounded-xl border border-vinyl-border px-3 py-1.5 text-xs text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Unfriend
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-sm text-vinyl-muted">
            No friends yet. Search for users above to get started.
          </div>
        )}
      </section>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add client/src/pages/Friends.tsx
git commit -m "feat: add Friends page with search, requests, and friends list"
```

---

## Task 9: Frontend — Add Friends Route + Navbar Tab with Badge

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Navbar.tsx`

**Step 1: Add route to `App.tsx`**

Add import at top (with other page imports):
```tsx
import Friends from './pages/Friends';
```

Add route inside the `<Route element={<Layout />}>` block, after the `/discover` route:
```tsx
<Route
  path="/friends"
  element={
    <ProtectedRoute>
      <Friends />
    </ProtectedRoute>
  }
/>
```

**Step 2: Add Friends tab to `Navbar.tsx`**

First, add the import for `friendsApi` and `useQuery` at the top of Navbar.tsx:
```tsx
import { useQuery } from '@tanstack/react-query';
import { friendsApi } from '../api/friends';
```

Then, inside the `Navbar` component function body (after the existing hooks), add:
```tsx
const { data: pendingRequests = [] } = useQuery({
  queryKey: ['friend-requests'],
  queryFn: () => friendsApi.getRequests(),
  enabled: !!user,
  staleTime: 60 * 1000,
});
const pendingCount = pendingRequests.length;
```

Then, in the center nav tabs section, add the Friends link between the Discover and Search links:
```tsx
{user && (
  <Link
    to="/friends"
    className={`rounded-lg px-4 py-1.5 text-sm transition-colors flex items-center gap-1.5 ${
      location.pathname === '/friends'
        ? 'bg-vinyl-card text-vinyl-text font-semibold shadow-sm'
        : 'text-vinyl-muted hover:text-vinyl-text'
    }`}
  >
    Friends
    {pendingCount > 0 && (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-vinyl-amber text-black text-[10px] font-bold leading-none">
        {pendingCount}
      </span>
    )}
  </Link>
)}
```

**Step 3: Verify in browser**

- Nav should now show: Feed | Discover | Friends | 🔍 Search
- Visit `/friends` — page loads, shows search + empty friends list
- Friends tab shows amber badge when there are pending requests

**Step 4: Commit**

```bash
git add client/src/App.tsx client/src/components/Navbar.tsx
git commit -m "feat: add /friends route and Friends nav tab with pending badge"
```

---

## Task 10: Frontend — Profile: Recent Reviews + Stats

**Files:**
- Modify: `client/src/pages/Profile.tsx`

**Step 1: Add import for `reviewsApi` and update the profile page**

At the top of `Profile.tsx`, add the `ReviewCard` import (it's already there via AlbumCard — add):
```tsx
import ReviewCard from '../components/ReviewCard';
```

Add a new query for reviews inside the component (after the `wantList` query):
```tsx
const { data: recentReviews } = useQuery({
  queryKey: ['user-reviews', username],
  queryFn: () => usersApi.getReviews(username!),
  enabled: !!username,
});
```

**Step 2: Add Stats row to the profile header**

After the existing `<div className="flex gap-4 mt-2 text-sm text-vinyl-muted">` block (the reviews/followers/following counts), add:

```tsx
<div className="flex gap-4 mt-1 text-sm text-vinyl-muted">
  {profile.avgRating != null && (
    <span>avg <strong className="text-vinyl-amber">{(profile.avgRating as number).toFixed(1)}★</strong></span>
  )}
  <span><strong className="text-vinyl-text">{(profile as any).friendCount ?? 0}</strong> friends</span>
</div>
```

**Step 3: Replace the Recent Reviews placeholder**

Find and replace:
```tsx
{/* Recent Reviews */}
<div>
  <h2 className="text-xl font-bold text-vinyl-text mb-4">Recent Reviews</h2>
  <p className="text-vinyl-muted text-sm">Reviews will appear here.</p>
</div>
```

With:
```tsx
{/* Recent Reviews */}
<div>
  <h2 className="text-xl font-bold text-vinyl-text mb-4">Recent Reviews</h2>
  {recentReviews && recentReviews.length > 0 ? (
    <div className="space-y-4">
      {recentReviews.map((review: any) => (
        <ReviewCard key={review.id} review={review} showAlbum />
      ))}
    </div>
  ) : (
    <p className="text-vinyl-muted text-sm">No reviews yet.</p>
  )}
</div>
```

**Step 4: Verify in browser**

Visit `/profile/<username>` for a user who has reviews. The Recent Reviews section should show ReviewCards instead of placeholder text. Stats row should show avgRating and friendCount.

**Step 5: Commit**

```bash
git add client/src/pages/Profile.tsx
git commit -m "feat: profile recent reviews and stats (avgRating, friendCount)"
```

---

## Task 11: Frontend — Home Feed Empty State Update

**Files:**
- Modify: `client/src/pages/Home.tsx`

**Step 1: Update the empty feed state**

Find the empty feed block and replace the message:

```tsx
<div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center space-y-3">
  <span className="text-5xl block">🎵</span>
  <p className="text-vinyl-text font-medium">Your feed is empty</p>
  <p className="text-vinyl-muted text-sm">
    Add friends to see their reviews here.
  </p>
  <Link
    to="/friends"
    className="inline-block mt-2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
  >
    Find Friends
  </Link>
</div>
```

**Step 2: Commit**

```bash
git add client/src/pages/Home.tsx
git commit -m "feat: update empty feed state to point to friends page"
```

---

## Task 12: Frontend — Discover Friends Shelf

**Files:**
- Modify: `client/src/pages/Discover.tsx`

**Step 1: Add imports**

Add at top:
```tsx
import { friendsApi } from '../api/friends';
```

**Step 2: Add the query inside the component**

After the `recentlyPlayed` query, add:
```tsx
const { data: friendsReviewed } = useQuery({
  queryKey: ['friends-recent-reviews'],
  queryFn: () => friendsApi.getRecentReviews(),
  enabled: !!user,
  staleTime: 5 * 60 * 1000,
});

const friendsAlbums = (friendsReviewed ?? []).map((a) => ({
  spotifyAlbumId: a.spotifyAlbumId,
  name: a.name,
  artist: a.artist,
  coverUrl: a.coverUrl,
  releaseYear: a.releaseYear,
  genres: a.genres,
}));
```

**Step 3: Add the shelf to the non-connected early return**

The current early return for non-Spotify users shows only a connect prompt. Change it to also show the friends shelf (if the user is logged in and has friend reviews):

Replace the early return block:
```tsx
if (!user || !spotifyConnected) {
  return (
    <div className="space-y-10">
      {friendsAlbums.length > 0 && (
        <HorizontalShelf
          albums={friendsAlbums}
          title="Friends' Recent Reviews"
          subtitle="· Albums your friends have reviewed"
        />
      )}
      <div className="flex flex-col items-center justify-center py-16 space-y-5 text-center">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 flex items-center justify-center">
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="#1DB954">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-vinyl-text">Connect Spotify to Discover</h2>
          <p className="text-vinyl-muted text-sm mt-1">
            See your most listened albums and personal listening history.
          </p>
        </div>
        <Link
          to="/settings"
          className="rounded-xl px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#1DB954' }}
        >
          Connect Spotify
        </Link>
      </div>
    </div>
  );
}
```

**Step 4: Add friends shelf to the connected view**

At the end of the returned `<div className="space-y-10">` in the Spotify-connected section, add before the closing `</div>`:

```tsx
{/* Friends' Recent Reviews */}
{friendsAlbums.length > 0 && (
  <HorizontalShelf
    albums={friendsAlbums}
    title="Friends' Recent Reviews"
    subtitle="· Albums your friends have reviewed"
  />
)}
```

**Step 5: Verify in browser**

Discover page should now show a "Friends' Recent Reviews" shelf when friends have reviewed albums (regardless of Spotify connection status).

**Step 6: Commit**

```bash
git add client/src/pages/Discover.tsx
git commit -m "feat: add friends recent reviews shelf to Discover page"
```

---

## Done

All 12 tasks complete. Verify end-to-end:

1. Register 2 users (userA, userB)
2. userA sends friend request to userB
3. userB accepts from `/friends` page (or profile page)
4. userA writes a review for an album
5. userB's feed at `/` shows userA's review, newest first
6. userB's Discover shows that album in "Friends' Recent Reviews"
7. userA's profile shows the review in "Recent Reviews" and shows stats (avgRating, friendCount)
8. Track star rating on `/album/:id` — hover and click a star, rating saves correctly
9. Navbar shows Friends tab between Discover and Search
10. Pending request badge appears on Friends tab when request is sent
