# Groovelog v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add review uniqueness, optional Spotify OAuth with recently-played auto-fill, Want-to-Listen UX fix, full UI redesign, and weekly trending albums.

**Architecture:** Backend changes go in `server/src/` (Express + Prisma + TypeScript). Frontend changes go in `client/src/` (React 18 + Vite + TailwindCSS v3). Spotify OAuth uses Authorization Code Flow server-side; tokens stored in DB. UI uses existing vinyl color tokens with new layout patterns.

**Tech Stack:** Express, Prisma (PostgreSQL), Zod, jsonwebtoken, node-fetch (already global in Node 18+), React 18, TanStack Query, React Router v6, Tailwind CSS v3.

**Design doc:** `docs/plans/2026-02-28-groovelog-v2-design.md`

---

### Task 1: Schema — review unique constraint + Spotify fields

**Files:**
- Modify: `server/prisma/schema.prisma`

**Context:** We need two schema changes: (1) prevent duplicate reviews per user+album, (2) add Spotify OAuth token fields to User.

**Step 1: Edit schema**

In `server/prisma/schema.prisma`, make these two changes:

**Review model** — add unique constraint after the existing fields:
```prisma
model Review {
  id             String     @id @default(cuid())
  userId         String
  reviewableType String
  reviewableId   String
  rating         Float
  bodyText       String?
  listenDate     DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  user           User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  albumCache     AlbumCache? @relation(fields: [reviewableId], references: [spotifyAlbumId])
  comments       Comment[]
  likes          ReviewLike[]
  @@unique([userId, reviewableType, reviewableId])
}
```

**User model** — add four optional Spotify fields after `reviewLikes`:
```prisma
  spotifyId           String?   @unique
  spotifyAccessToken  String?
  spotifyRefreshToken String?
  spotifyTokenExpiry  DateTime?
```

**Step 2: Push to database**

```bash
cd server && npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

**Step 3: Commit**

```bash
cd .. && git add server/prisma/schema.prisma
git commit -m "feat: add review unique constraint and spotify oauth fields to schema"
```

---

### Task 2: Backend — review uniqueness (GET /reviews/mine + POST guard)

**Files:**
- Modify: `server/src/routes/reviews.ts`
- Modify: `server/src/__tests__/reviews.test.ts`

**Context:** Add `GET /api/reviews/mine?albumId=X` so the frontend can check if the user already reviewed an album. Also guard `POST /api/reviews` to return 409 if a review already exists for that user+album.

**Step 1: Write the failing tests** — add to `server/src/__tests__/reviews.test.ts`:

```typescript
describe('GET /api/reviews/mine', () => {
  it('returns 401 if not authenticated', async () => {
    const res = await request(app).get('/api/reviews/mine?albumId=abc');
    expect(res.status).toBe(401);
  });

  it('returns 404 if no review exists', async () => {
    const res = await request(app)
      .get('/api/reviews/mine?albumId=nonexistent')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns existing review', async () => {
    // Create a review first
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'test-album-mine', rating: 4 });

    const res = await request(app)
      .get('/api/reviews/mine?albumId=test-album-mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4);
  });
});

describe('POST /api/reviews duplicate prevention', () => {
  it('returns 409 if review already exists for this user+album', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'dup-test-album', rating: 3 });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'dup-test-album', rating: 4 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd server && npm test -- --testPathPattern=reviews 2>&1 | tail -20
```

Expected: FAIL (routes don't exist yet).

**Step 3: Implement in `server/src/routes/reviews.ts`**

Add `GET /reviews/mine` route (insert BEFORE the `GET /:id` route to avoid param conflict):

```typescript
router.get('/mine', requireAuth, async (req: AuthRequest, res: Response) => {
  const albumId = req.query.albumId as string;
  if (!albumId) { res.status(400).json({ error: 'albumId required' }); return; }
  try {
    const review = await prisma.review.findUnique({
      where: {
        userId_reviewableType_reviewableId: {
          userId: req.user!.id,
          reviewableType: 'album',
          reviewableId: albumId,
        },
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    if (!review) { res.status(404).json({ error: 'No review found' }); return; }
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

In `POST /` (the create review route), add a duplicate check before `prisma.review.create`:

```typescript
// After parse.success check, before create:
const existing = await prisma.review.findUnique({
  where: {
    userId_reviewableType_reviewableId: {
      userId: req.user!.id,
      reviewableType,
      reviewableId,
    },
  },
});
if (existing) {
  res.status(409).json({ error: 'You have already reviewed this album' });
  return;
}
```

**Step 4: Run tests**

```bash
cd server && npm test -- --testPathPattern=reviews 2>&1 | tail -20
```

Expected: All tests PASS.

**Step 5: Commit**

```bash
cd .. && git add server/src/routes/reviews.ts server/src/__tests__/reviews.test.ts
git commit -m "feat: prevent duplicate reviews, add GET /reviews/mine endpoint"
```

---

### Task 3: Backend — weekly trending albums endpoint

**Files:**
- Modify: `server/src/routes/albums.ts`
- Modify: `server/src/__tests__/albums.test.ts`

**Context:** `GET /api/albums/trending?limit=6` returns the most-reviewed albums in the past 7 days, sorted by review count desc. No auth required.

**Step 1: Write the failing test** — add to `server/src/__tests__/albums.test.ts`:

```typescript
describe('GET /api/albums/trending', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/albums/trending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit query param', async () => {
    const res = await request(app).get('/api/albums/trending?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });
});
```

**Step 2: Run to verify fail**

```bash
cd server && npm test -- --testPathPattern=albums 2>&1 | tail -20
```

**Step 3: Implement in `server/src/routes/albums.ts`**

Add before `router.get('/:id', ...)`:

```typescript
router.get('/trending', async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 6, 20);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  try {
    const grouped = await prisma.review.groupBy({
      by: ['reviewableId'],
      where: {
        reviewableType: 'album',
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { id: true },
      _avg: { rating: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    const albumIds = grouped.map((g) => g.reviewableId);
    const albums = await prisma.albumCache.findMany({
      where: { spotifyAlbumId: { in: albumIds } },
    });

    const albumMap = Object.fromEntries(albums.map((a) => [a.spotifyAlbumId, a]));

    const result = grouped
      .filter((g) => albumMap[g.reviewableId])
      .map((g) => ({
        ...albumMap[g.reviewableId],
        reviewCount: g._count.id,
        avgRating: g._avg.rating,
      }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 4: Run tests**

```bash
cd server && npm test -- --testPathPattern=albums 2>&1 | tail -20
```

Expected: PASS.

**Step 5: Commit**

```bash
cd .. && git add server/src/routes/albums.ts server/src/__tests__/albums.test.ts
git commit -m "feat: add GET /api/albums/trending endpoint"
```

---

### Task 4: Backend — Spotify OAuth routes + recently-played endpoint

**Files:**
- Create: `server/src/routes/spotify.ts`
- Modify: `server/src/app.ts`
- Modify: `server/.env` (user must add SPOTIFY_REDIRECT_URI)

**Context:** Three new routes: (1) initiate OAuth, (2) handle callback, (3) fetch recently-played for authenticated user. Uses Authorization Code Flow. Access token auto-refreshes when expired.

**Note for implementer:** No automated tests for OAuth routes (they require real browser redirect). Test manually after implementation.

**Step 1: Add env vars**

In `server/.env`, add:
```
SPOTIFY_REDIRECT_URI="http://localhost:3001/api/spotify/callback"
```

Also add to `.env.example`:
```
SPOTIFY_REDIRECT_URI="http://localhost:3001/api/spotify/callback"
```

**Step 2: Create `server/src/routes/spotify.ts`**

```typescript
import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const SCOPES = 'user-read-recently-played';

// Step 1: Redirect user to Spotify OAuth
router.get('/connect', requireAuth, (req: AuthRequest, res: Response) => {
  const state = req.user!.id; // use userId as state for CSRF + identity
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    scope: SCOPES,
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    state,
  });
  res.redirect(`https://accounts.spotify.com/authorize?${params}`);
});

// Step 2: Handle callback from Spotify
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const clientUrl = process.env.CLIENT_URL!;

  if (error || !code || !state) {
    res.redirect(`${clientUrl}/spotify-error`);
    return;
  }

  try {
    // Exchange code for tokens
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(`${clientUrl}/spotify-error`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get Spotify user profile to get spotifyId
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = (await profileRes.json()) as { id: string };

    // Save to DB (state = userId)
    await prisma.user.update({
      where: { id: state },
      data: {
        spotifyId: profile.id,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    res.redirect(`${clientUrl}/spotify-success`);
  } catch {
    res.redirect(`${clientUrl}/spotify-error`);
  }
});

// Step 3: Get recently played albums for current user
router.get('/recently-played', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { spotifyAccessToken: true, spotifyRefreshToken: true, spotifyTokenExpiry: true },
    });

    if (!user?.spotifyAccessToken) {
      res.status(400).json({ error: 'Spotify not connected' });
      return;
    }

    let accessToken = user.spotifyAccessToken;

    // Refresh token if expired
    if (!user.spotifyTokenExpiry || user.spotifyTokenExpiry < new Date()) {
      const creds = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');
      const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.spotifyRefreshToken!,
        }),
      });
      if (!refreshRes.ok) {
        res.status(401).json({ error: 'Spotify token refresh failed' });
        return;
      }
      const refreshed = (await refreshRes.json()) as { access_token: string; expires_in: number };
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          spotifyAccessToken: refreshed.access_token,
          spotifyTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const recentRes = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!recentRes.ok) {
      res.status(502).json({ error: 'Failed to fetch Spotify history' });
      return;
    }

    const data = (await recentRes.json()) as {
      items: Array<{
        track: { album: { id: string; name: string } };
        played_at: string;
      }>;
    };

    // Deduplicate by album, keep most recent play
    const seen = new Set<string>();
    const result = data.items
      .filter((item) => {
        if (seen.has(item.track.album.id)) return false;
        seen.add(item.track.album.id);
        return true;
      })
      .map((item) => ({
        albumId: item.track.album.id,
        albumName: item.track.album.name,
        playedAt: item.played_at,
      }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
```

**Step 3: Register route in `server/src/app.ts`**

Add import and mount:
```typescript
import spotifyRouter from './routes/spotify';
// ...
app.use('/api/spotify', spotifyRouter);
```

**Step 4: Update `server/src/routes/auth.ts` — add spotifyConnected to /me response**

In the `GET /me` route, add `spotifyId` to the `select`:
```typescript
select: { id: true, email: true, username: true, bio: true, avatarUrl: true, createdAt: true, spotifyId: true },
```

**Step 5: Commit**

```bash
cd .. && git add server/src/routes/spotify.ts server/src/app.ts server/src/routes/auth.ts server/.env.example
git commit -m "feat: spotify oauth connect, callback, and recently-played endpoint"
```

---

### Task 5: Frontend — API wrappers for new endpoints

**Files:**
- Modify: `client/src/api/reviews.ts`
- Modify: `client/src/api/albums.ts`
- Create: `client/src/api/spotify.ts`

**Context:** Add client-side wrappers for the three new backend features.

**Step 1: Update `client/src/api/reviews.ts`**

Add:
```typescript
  getMyReview: (albumId: string) =>
    api.get(`/api/reviews/mine?albumId=${albumId}`).then((r) => r.data),
  update: (id: string, data: Partial<{ rating: number; bodyText: string; listenDate: string }>) =>
    api.put(`/api/reviews/${id}`, data).then((r) => r.data),
```

**Step 2: Update `client/src/api/albums.ts`**

Add:
```typescript
  getTrending: (limit = 6) =>
    api.get(`/api/albums/trending?limit=${limit}`).then((r) => r.data),
```

**Step 3: Create `client/src/api/spotify.ts`**

```typescript
import { api } from './client';

export const spotifyApi = {
  connect: () => {
    // Redirects browser to Spotify OAuth
    window.location.href = `${import.meta.env.VITE_API_URL}/api/spotify/connect`;
  },
  getRecentlyPlayed: () =>
    api.get('/api/spotify/recently-played').then((r) => r.data as Array<{
      albumId: string;
      albumName: string;
      playedAt: string;
    }>),
};
```

**Step 4: Update `client/src/context/AuthContext.tsx`**

Add `spotifyConnected` to the User interface and context:
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  spotifyId?: string; // add this
}
```

**Step 5: Commit**

```bash
cd .. && git add client/src/api/reviews.ts client/src/api/albums.ts client/src/api/spotify.ts client/src/context/AuthContext.tsx
git commit -m "feat: add api wrappers for mine, trending, and spotify endpoints"
```

---

### Task 6: Frontend — AlbumDetail + WriteReview: one-review enforcement

**Files:**
- Modify: `client/src/pages/AlbumDetail.tsx`
- Modify: `client/src/pages/WriteReview.tsx`

**Context:** AlbumDetail checks if the user already has a review. If yes → "Edit Review" button. WriteReview loads the existing review when `?reviewId=X` is in the URL and uses PUT instead of POST.

**Step 1: Update `client/src/pages/AlbumDetail.tsx`**

Add a query for the user's own review:
```typescript
const { data: myReview } = useQuery({
  queryKey: ['my-review', id],
  queryFn: () => reviewsApi.getMyReview(id!),
  enabled: !!user && !!id,
  retry: false, // 404 is expected if no review
});
```

Replace the "Write Review" link with conditional:
```tsx
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
```

**Step 2: Update `client/src/pages/WriteReview.tsx`**

Read `reviewId` from URL params. If present, load existing review and use PUT:

```typescript
const reviewId = searchParams.get('reviewId') ?? '';
const isEditing = !!reviewId;

// Load existing review if editing
const { data: existingReview } = useQuery({
  queryKey: ['review', reviewId],
  queryFn: () => reviewsApi.getById(reviewId),
  enabled: isEditing,
});

// Pre-fill form when existing review loads
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

// Mutation: use PUT when editing
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
```

Update the submit button text:
```tsx
{mutation.isPending ? 'Submitting...' : isEditing ? 'Update Review' : 'Submit Review'}
```

Update the h1:
```tsx
<h1 className="text-2xl font-bold text-vinyl-text">
  {isEditing ? 'Edit Review' : 'Write a Review'}
</h1>
```

Also add `reviewsApi.getById` to `client/src/api/reviews.ts`:
```typescript
  getById: (id: string) => api.get(`/api/reviews/${id}`).then((r) => r.data),
```

**Step 3: Commit**

```bash
cd .. && git add client/src/pages/AlbumDetail.tsx client/src/pages/WriteReview.tsx client/src/api/reviews.ts
git commit -m "feat: one review per user - edit mode in WriteReview, conditional button in AlbumDetail"
```

---

### Task 7: Frontend — Want to Listen UX fix

**Files:**
- Modify: `client/src/pages/AlbumDetail.tsx`

**Context:** Hide buttons from logged-out users. Show visual feedback after clicking (button state change). Show error if API fails.

**Step 1: Update AlbumDetail.tsx button section**

Replace the current button section with:

```tsx
{/* Listening actions */}
{user ? (
  <div className="flex gap-3 pt-2 flex-wrap">
    {user && (
      <>{/* Write/Edit Review link already here */}</>
    )}
    <button
      onClick={() => listenMutation.mutate('want')}
      disabled={listenMutation.isPending}
      className={`rounded-xl border px-5 py-2 text-sm transition-colors ${
        listenStatus === 'want'
          ? 'border-vinyl-amber bg-vinyl-amber/10 text-vinyl-amber'
          : 'border-vinyl-border hover:border-vinyl-amber/50'
      }`}
    >
      {listenStatus === 'want' ? '✓ Want to Listen' : 'Want to Listen'}
    </button>
    <button
      onClick={() => listenMutation.mutate('listened')}
      disabled={listenMutation.isPending}
      className={`rounded-xl border px-5 py-2 text-sm transition-colors ${
        listenStatus === 'listened'
          ? 'border-vinyl-amber bg-vinyl-amber/10 text-vinyl-amber'
          : 'border-vinyl-border hover:border-vinyl-amber/50'
      }`}
    >
      {listenStatus === 'listened' ? '✓ Listened' : 'Mark Listened'}
    </button>
  </div>
) : (
  <p className="text-sm text-vinyl-muted pt-2">
    <Link to="/login" className="text-vinyl-amber hover:underline">Log in</Link> to track this album
  </p>
)}
{listenMutation.isError && (
  <p className="text-sm text-red-400">Failed to update list. Try again.</p>
)}
```

Add `listenStatus` state:
```typescript
const [listenStatus, setListenStatus] = useState<'want' | 'listened' | null>(null);
```

Update listenMutation to set status on success:
```typescript
const listenMutation = useMutation({
  mutationFn: (status: 'want' | 'listened') => listeningApi.addToList(id!, status),
  onSuccess: (_data, status) => setListenStatus(status),
});
```

**Step 2: Commit**

```bash
cd .. && git add client/src/pages/AlbumDetail.tsx
git commit -m "fix: want to listen UX - auth gate, visual feedback, error display"
```

---

### Task 8: Frontend — Trending albums section on Home

**Files:**
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/components/AlbumCard.tsx`

**Context:** Show "This Week" section above the feed with the top 6 most-reviewed albums in the past 7 days. Always visible (public data). AlbumCard needs to accept a `compact` prop for this grid.

**Step 1: Check existing AlbumCard**

Read `client/src/components/AlbumCard.tsx` to understand the current props.

**Step 2: Update `client/src/pages/Home.tsx`**

```typescript
import { albumsApi } from '../api/albums';
import AlbumCard from '../components/AlbumCard';

// Inside component, add trending query:
const { data: trending } = useQuery({
  queryKey: ['trending'],
  queryFn: () => albumsApi.getTrending(6),
  staleTime: 5 * 60 * 1000, // 5 min cache
});
```

Add trending section above the feed:
```tsx
{/* This Week */}
{trending && trending.length > 0 && (
  <div>
    <h2 className="text-lg font-bold text-vinyl-text mb-3">
      This Week
      <span className="ml-2 text-xs font-normal text-vinyl-muted">
        Most reviewed
      </span>
    </h2>
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {trending.map((album: any) => (
        <AlbumCard key={album.spotifyAlbumId} album={album} />
      ))}
    </div>
  </div>
)}
```

**Step 3: Commit**

```bash
cd .. && git add client/src/pages/Home.tsx
git commit -m "feat: weekly trending albums section on home page"
```

---

### Task 9: Frontend — Full UI Redesign

**Files:**
- Modify: `client/src/components/Navbar.tsx`
- Modify: `client/src/components/Layout.tsx`
- Modify: `client/src/components/ReviewCard.tsx`
- Modify: `client/src/components/AlbumCard.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/pages/AlbumDetail.tsx`
- Modify: `client/src/pages/Discover.tsx`
- Modify: `client/src/pages/WriteReview.tsx`
- Modify: `client/src/pages/Login.tsx`
- Modify: `client/src/pages/Register.tsx`

**Context:** Full visual overhaul. Apple Music dark × Letterboxd aesthetic. Keep all vinyl color tokens. Improve spacing, typography, hover states, and layout.

**Step 1: Redesign `Navbar.tsx`**

```tsx
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path ? 'text-vinyl-text' : 'text-vinyl-muted hover:text-vinyl-text';

  return (
    <nav className="sticky top-0 z-50 border-b border-vinyl-border/60 bg-vinyl-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-vinyl-amber flex items-center justify-center text-black font-black text-sm">G</div>
          <span className="text-lg font-black tracking-tight text-vinyl-text group-hover:text-vinyl-amber transition-colors">
            GROOVELOG
          </span>
        </Link>

        <div className="flex items-center gap-8 text-sm font-medium">
          <Link to="/discover" className={`transition-colors ${isActive('/discover')}`}>Discover</Link>
          {user && (
            <Link to="/" className={`transition-colors ${isActive('/')}`}>Feed</Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                to={`/profile/${user.username}`}
                className="flex items-center gap-2 rounded-full border border-vinyl-border px-3 py-1.5 text-sm hover:border-vinyl-amber/50 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber text-xs font-bold">
                  {user.username[0].toUpperCase()}
                </div>
                <span className="text-vinyl-text">{user.username}</span>
              </Link>
              <button
                onClick={() => { logout(); navigate('/login'); }}
                className="text-sm text-vinyl-muted hover:text-vinyl-text transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-sm text-vinyl-muted hover:text-vinyl-text transition-colors">
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-full bg-vinyl-amber px-4 py-1.5 text-sm text-black font-semibold hover:bg-vinyl-amber-light transition-colors"
              >
                Join free
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
```

**Step 2: Redesign `AlbumCard.tsx`**

```tsx
import { Link } from 'react-router-dom';

interface Album {
  spotifyAlbumId: string;
  name: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  avgRating?: number | null;
  reviewCount?: number;
}

export default function AlbumCard({ album }: { album: Album }) {
  return (
    <Link to={`/album/${album.spotifyAlbumId}`} className="group block">
      <div className="relative overflow-hidden rounded-xl aspect-square bg-vinyl-surface">
        <img
          src={album.coverUrl}
          alt={album.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{album.name}</p>
          <p className="text-white/70 text-xs line-clamp-1 mt-0.5">{album.artist}</p>
          {album.avgRating && (
            <div className="mt-1 inline-flex items-center gap-1">
              <span className="text-vinyl-amber text-xs">★</span>
              <span className="text-white text-xs font-medium">{album.avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-vinyl-text leading-tight line-clamp-1 group-hover:text-vinyl-amber transition-colors">{album.name}</p>
        <p className="text-xs text-vinyl-muted line-clamp-1">{album.artist}</p>
      </div>
    </Link>
  );
}
```

**Step 3: Redesign `ReviewCard.tsx`**

```tsx
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
            className="h-14 w-14 rounded-lg object-cover shadow-md"
          />
          <div>
            <p className="font-semibold text-vinyl-text text-sm">{review.albumCache.name}</p>
            <p className="text-xs text-vinyl-muted mt-0.5">{review.albumCache.artist}</p>
          </div>
        </Link>
      )}

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <Link to={`/profile/${review.user.username}`} className="flex items-center gap-2.5 group/user">
            <div className="h-9 w-9 rounded-full bg-vinyl-amber/15 flex items-center justify-center text-vinyl-amber font-bold text-sm ring-1 ring-vinyl-amber/20 shrink-0">
              {review.user.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-vinyl-text group-hover/user:text-vinyl-amber transition-colors leading-tight">
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
```

**Step 4: Redesign `AlbumDetail.tsx` hero**

Replace the hero `<div>` with:

```tsx
{/* Hero with blurred background */}
<div className="relative -mx-4 -mt-8 mb-8 overflow-hidden rounded-b-2xl">
  {/* Blurred background */}
  <div
    className="absolute inset-0 scale-110"
    style={{
      backgroundImage: `url(${album.coverUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      filter: 'blur(40px)',
      opacity: 0.3,
    }}
  />
  <div className="absolute inset-0 bg-gradient-to-b from-vinyl-bg/20 via-vinyl-bg/60 to-vinyl-bg" />

  {/* Content */}
  <div className="relative flex flex-col gap-6 px-6 pt-10 pb-8 md:flex-row md:items-end">
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
      {/* Action buttons stay here */}
    </div>
  </div>
</div>
```

**Step 5: Redesign `Discover.tsx`**

Replace the search form with a hero-style search:

```tsx
<div className="space-y-8">
  {/* Hero search */}
  <div className="text-center space-y-4 py-8">
    <h1 className="text-4xl font-black text-vinyl-text">Discover Music</h1>
    <p className="text-vinyl-muted">Search millions of albums from Spotify</p>
    <form onSubmit={(e) => { e.preventDefault(); setSearch(query); }} className="max-w-xl mx-auto">
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-vinyl-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search albums, artists..."
          className="w-full rounded-2xl border border-vinyl-border bg-vinyl-surface pl-12 pr-32 py-4 text-vinyl-text placeholder-vinyl-muted focus:border-vinyl-amber focus:outline-none text-base"
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors text-sm"
        >
          Search
        </button>
      </div>
    </form>
  </div>
  {/* rest of results grid unchanged */}
</div>
```

**Step 6: Redesign `Login.tsx` and `Register.tsx`**

Replace the outer container with a split layout feeling. Add a decorative left panel or just improve the card:

```tsx
// Outer wrapper for both Login and Register:
<div className="min-h-screen bg-vinyl-bg flex">
  {/* Decorative left side */}
  <div className="hidden lg:flex lg:w-1/2 bg-vinyl-surface items-center justify-center p-12 relative overflow-hidden">
    <div className="absolute inset-0" style={{
      background: 'radial-gradient(circle at 30% 50%, rgba(245,158,11,0.08) 0%, transparent 70%)',
    }} />
    <div className="relative text-center space-y-4">
      <div className="w-20 h-20 rounded-full bg-vinyl-amber mx-auto flex items-center justify-center text-black font-black text-3xl">G</div>
      <h2 className="text-3xl font-black text-vinyl-text">GROOVELOG</h2>
      <p className="text-vinyl-muted max-w-xs">Track, review, and discover albums with people who love music.</p>
    </div>
  </div>

  {/* Right side: form */}
  <div className="flex-1 flex items-center justify-center p-8">
    <div className="w-full max-w-sm space-y-6">
      {/* Logo on mobile */}
      <div className="lg:hidden text-center">
        <div className="w-12 h-12 rounded-full bg-vinyl-amber mx-auto flex items-center justify-center text-black font-black text-xl mb-3">G</div>
        <h2 className="text-xl font-black text-vinyl-amber">GROOVELOG</h2>
      </div>
      {/* Form card */}
      <div className="rounded-2xl border border-vinyl-border bg-vinyl-surface p-8 space-y-5">
        {/* ... existing form fields, just update className spacing ... */}
      </div>
    </div>
  </div>
</div>
```

**Step 7: Redesign `Home.tsx` — two-section layout**

The trending section was added in Task 8. Now improve the feed section header and empty state:

```tsx
<div className="space-y-8">
  {/* Trending section (already added) */}

  {/* Feed section */}
  <div>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-bold text-vinyl-text">Your Feed</h2>
      <Link to="/discover" className="text-xs text-vinyl-amber hover:underline font-medium">
        Discover →
      </Link>
    </div>
    {/* ... feed content ... */}
  </div>
</div>
```

**Step 8: Commit all UI changes**

```bash
cd .. && git add client/src/components/Navbar.tsx client/src/components/AlbumCard.tsx client/src/components/ReviewCard.tsx client/src/pages/AlbumDetail.tsx client/src/pages/Discover.tsx client/src/pages/Home.tsx client/src/pages/Login.tsx client/src/pages/Register.tsx client/src/pages/WriteReview.tsx
git commit -m "feat: complete UI redesign - modern dark aesthetic, improved layout, blur hero, hover states"
```

---

### Task 10: Frontend — Spotify connect flow

**Files:**
- Modify: `client/src/pages/Register.tsx`
- Create: `client/src/pages/SpotifySuccess.tsx`
- Create: `client/src/pages/SpotifyError.tsx`
- Modify: `client/src/pages/WriteReview.tsx`
- Modify: `client/src/App.tsx`

**Context:** After registration, show optional "Connect Spotify" step. Add `/spotify-success` and `/spotify-error` routes. Add "Fetch from Spotify" button in WriteReview.

**Step 1: Update `Register.tsx` to show post-register Spotify step**

Add a `registered` state. After `login(data.token)` succeeds, instead of navigating away, set `registered = true` to show the Spotify step UI.

```typescript
const [registered, setRegistered] = useState(false);

// In handleSubmit, after await login(data.token):
setRegistered(true);
// Remove navigate('/discover') from here

// Render: if registered, show Spotify step
if (registered) {
  return (
    <div className="min-h-screen bg-vinyl-bg flex items-center justify-center p-8">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/30 mx-auto flex items-center justify-center">
          <svg viewBox="0 0 24 24" className="w-8 h-8 fill-[#1DB954]">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-black text-vinyl-text">Connect Spotify</h2>
          <p className="text-vinyl-muted mt-2 text-sm">
            Link your Spotify account to auto-fill listen dates when you write reviews.
          </p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => spotifyApi.connect()}
            className="w-full rounded-2xl bg-[#1DB954] py-3 font-semibold text-black hover:bg-[#1ed760] transition-colors"
          >
            Connect Spotify
          </button>
          <button
            onClick={() => navigate('/discover')}
            className="w-full text-sm text-vinyl-muted hover:text-vinyl-text transition-colors py-2"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create `client/src/pages/SpotifySuccess.tsx`**

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SpotifySuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate('/'), 2000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-vinyl-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 mx-auto flex items-center justify-center">
          <svg className="w-8 h-8 text-[#1DB954]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-vinyl-text">Spotify Connected!</h2>
        <p className="text-vinyl-muted text-sm">Redirecting you home...</p>
      </div>
    </div>
  );
}
```

**Step 3: Create `client/src/pages/SpotifyError.tsx`**

```tsx
import { Link } from 'react-router-dom';

export default function SpotifyError() {
  return (
    <div className="min-h-screen bg-vinyl-bg flex items-center justify-center">
      <div className="text-center space-y-4">
        <p className="text-2xl">⚠️</p>
        <h2 className="text-xl font-bold text-vinyl-text">Spotify connection failed</h2>
        <p className="text-vinyl-muted text-sm">You can try again from your profile settings.</p>
        <Link to="/" className="inline-block text-vinyl-amber hover:underline text-sm">Go home</Link>
      </div>
    </div>
  );
}
```

**Step 4: Add routes in `client/src/App.tsx`**

```tsx
import SpotifySuccess from './pages/SpotifySuccess';
import SpotifyError from './pages/SpotifyError';

// Add inside <Routes> (outside Layout, no auth required):
<Route path="/spotify-success" element={<SpotifySuccess />} />
<Route path="/spotify-error" element={<SpotifyError />} />
```

**Step 5: Add "Fetch from Spotify" to `WriteReview.tsx`**

```typescript
import { spotifyApi } from '../api/spotify';
import { useAuth } from '../context/AuthContext';

const { user } = useAuth();
const spotifyConnected = !!user?.spotifyId;

// Add state for fetch button
const [fetchingSpotify, setFetchingSpotify] = useState(false);

async function fetchListenDate() {
  setFetchingSpotify(true);
  try {
    const history = await spotifyApi.getRecentlyPlayed();
    const match = history.find((item) => item.albumId === albumId);
    if (match) {
      setListenDate(new Date(match.playedAt).toISOString().slice(0, 10));
    } else {
      // no match found, just leave field empty
    }
  } catch {
    // silently fail
  } finally {
    setFetchingSpotify(false);
  }
}
```

In the listen date field section:
```tsx
<div>
  <div className="flex items-center justify-between mb-2">
    <label className="block text-sm font-medium text-vinyl-muted">Listen date (optional)</label>
    {spotifyConnected && (
      <button
        type="button"
        onClick={fetchListenDate}
        disabled={fetchingSpotify}
        className="text-xs text-[#1DB954] hover:underline disabled:opacity-50"
      >
        {fetchingSpotify ? 'Fetching...' : '↑ Fetch from Spotify'}
      </button>
    )}
  </div>
  <input type="date" ... />
</div>
```

**Step 6: Commit**

```bash
cd .. && git add client/src/pages/Register.tsx client/src/pages/SpotifySuccess.tsx client/src/pages/SpotifyError.tsx client/src/pages/WriteReview.tsx client/src/App.tsx
git commit -m "feat: spotify connect flow - post-register step, success/error pages, fetch listen date in review"
```

---

### Task 11: Spotify Dashboard setup + smoke test

**Context:** Manual step — user must configure Spotify app before OAuth works.

**Step 1: Spotify Dashboard**

1. Go to https://developer.spotify.com/dashboard
2. Click on your app (same app you used for Client Credentials)
3. Click "Edit Settings"
4. Under "Redirect URIs" add: `http://localhost:3001/api/spotify/callback`
5. Click "Add" then "Save"

**Step 2: Verify server env**

Check `server/.env` has `SPOTIFY_REDIRECT_URI="http://localhost:3001/api/spotify/callback"`

**Step 3: Smoke test the full flow**

1. Register a new account → "Connect Spotify" step should appear
2. Click "Connect Spotify" → Spotify auth page opens
3. Authorize → redirected to `http://localhost:5173/spotify-success`
4. Go to an album → "Write Review" → "Fetch from Spotify" button appears
5. Click it → listen date fills in (if you've listened to that album recently on Spotify)

**Step 4: Commit final memory update**

```bash
git add -A && git commit -m "chore: groovelog v2 complete - review uniqueness, spotify oauth, ui redesign, trending"
```
