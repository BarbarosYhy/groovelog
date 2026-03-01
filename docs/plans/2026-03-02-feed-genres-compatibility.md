# Feed Toggle, Genre Radar & Compatibility Meter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Community Feed to the Home page with a Friends/Community toggle, add a Spotify-driven genre radar chart to every profile, and add a taste-compatibility meter on other users' profiles.

**Architecture:** Two new backend endpoints on the users router (top-genres via Spotify API, compatibility via Prisma genre aggregation). Three frontend changes: GenreRadar.tsx and CompatibilityMeter.tsx as new SVG components; Profile.tsx consumes both; Home.tsx gets a feed toggle; Discover.tsx loses its CommunityFeed section.

**Tech Stack:** Express + Prisma + Spotify Web API (server); React 18 + TanStack Query + SVG (client); Tailwind CSS vinyl theme.

---

## Quick Reference

| Token | Value |
|-------|-------|
| `vinyl-bg` | #0d0d0d |
| `vinyl-surface` | #1a1a1a |
| `vinyl-card` | #242424 |
| `vinyl-border` | #333333 |
| `vinyl-amber` | #f59e0b |
| `vinyl-amber-light` | #fbbf24 |
| `vinyl-muted` | #6b7280 |
| `vinyl-text` | #e5e7eb |

Server working directory for all commands: `C:\Users\ASUS\Desktop\claudelaeneteresanmacerealar\server`
Client working directory: `C:\Users\ASUS\Desktop\claudelaeneteresanmacerealar\client`
Root: `C:\Users\ASUS\Desktop\claudelaeneteresanmacerealar`

---

## Task 1: Export getUserSpotifyToken from spotify.ts

The `getUserSpotifyToken` helper is defined privately in `server/src/routes/spotify.ts`. The top-genres endpoint (Task 2) lives in `users.ts` and needs this helper.

**Files:**
- Modify: `server/src/routes/spotify.ts:16`

**Step 1: Open `server/src/routes/spotify.ts` and add `export` to the function declaration**

Find line 16:
```ts
async function getUserSpotifyToken(userId: string): Promise<string> {
```

Change to:
```ts
export async function getUserSpotifyToken(userId: string): Promise<string> {
```

**Step 2: Verify**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/server && npx tsc --noEmit 2>&1
```
Expected: no errors.

**Step 3: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add server/src/routes/spotify.ts && git commit -m "refactor: export getUserSpotifyToken for use in other routes"
```

---

## Task 2: Backend — GET /api/users/:username/top-genres

**Files:**
- Modify: `server/src/routes/users.ts`

This endpoint fetches the profile user's Spotify top tracks, extracts artist IDs, batch-fetches artist genres, and returns the top 5 genres with percentages. It must be placed **before** the `GET /:username` catch-all route.

**Step 1: Add the import at the top of `server/src/routes/users.ts`**

After the existing imports (around line 4), add:
```ts
import { getUserSpotifyToken } from './spotify';
```

**Step 2: Add the route before `GET /:username`**

Insert this block immediately before the `router.get('/:username', ...)` route:

```ts
router.get('/:username/top-genres', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true, spotifyAccessToken: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    if (!user.spotifyAccessToken) { res.json({ connected: false }); return; }

    let accessToken: string;
    try {
      accessToken = await getUserSpotifyToken(user.id);
    } catch {
      res.json({ connected: false });
      return;
    }

    // Fetch top 50 tracks (short_term = last ~4 weeks)
    const tracksRes = await fetch(
      'https://api.spotify.com/v1/me/top/tracks?limit=50&time_range=short_term',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!tracksRes.ok) { res.json({ connected: false }); return; }

    const tracksData = (await tracksRes.json()) as {
      items: Array<{ artists: Array<{ id: string }> }>;
    };

    // Collect unique artist IDs (max 50 for one batch request)
    const artistIds = [
      ...new Set(tracksData.items.flatMap((t) => t.artists.map((a) => a.id))),
    ].slice(0, 50);

    if (artistIds.length === 0) { res.json({ connected: true, genres: [] }); return; }

    // Batch-fetch artist objects to get genres
    const artistsRes = await fetch(
      `https://api.spotify.com/v1/artists?ids=${artistIds.join(',')}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!artistsRes.ok) { res.json({ connected: true, genres: [] }); return; }

    const artistsData = (await artistsRes.json()) as {
      artists: Array<{ genres: string[] }>;
    };

    // Aggregate genre counts
    const counts: Record<string, number> = {};
    for (const artist of artistsData.artists) {
      for (const genre of artist.genres) {
        counts[genre] = (counts[genre] ?? 0) + 1;
      }
    }

    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    if (total === 0) { res.json({ connected: true, genres: [] }); return; }

    const top5 = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
      }));

    res.json({ connected: true, genres: top5 });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 3: Verify TypeScript**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/server && npx tsc --noEmit 2>&1
```
Expected: no errors.

**Step 4: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add server/src/routes/users.ts && git commit -m "feat: GET /api/users/:username/top-genres via Spotify short-term top tracks"
```

---

## Task 3: Backend — GET /api/users/:username/compatibility

**Files:**
- Modify: `server/src/routes/users.ts`

Compares the logged-in user's genre taste (from their album review history) against the profile user's genre taste using weighted Jaccard similarity. Insert **before** `GET /:username` (after the top-genres route from Task 2).

**Step 1: Add the route**

```ts
router.get('/:username/compatibility', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const other = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!other) { res.status(404).json({ error: 'User not found' }); return; }

    const myId = req.user!.id;
    const otherId = other.id;

    if (myId === otherId) { res.json({ score: 100, sharedGenres: [], myTopGenre: null, theirTopGenre: null }); return; }

    // Get both users' album reviews with genre data
    const [myReviews, theirReviews] = await Promise.all([
      prisma.review.findMany({
        where: { userId: myId, reviewableType: 'album' },
        include: { albumCache: { select: { genres: true } } },
      }),
      prisma.review.findMany({
        where: { userId: otherId, reviewableType: 'album' },
        include: { albumCache: { select: { genres: true } } },
      }),
    ]);

    // Build genre frequency maps
    function buildGenreMap(reviews: typeof myReviews): Record<string, number> {
      const map: Record<string, number> = {};
      for (const r of reviews) {
        for (const genre of r.albumCache?.genres ?? []) {
          map[genre] = (map[genre] ?? 0) + 1;
        }
      }
      return map;
    }

    const myMap = buildGenreMap(myReviews);
    const theirMap = buildGenreMap(theirReviews);

    const allGenres = new Set([...Object.keys(myMap), ...Object.keys(theirMap)]);

    let sumMin = 0;
    let sumMax = 0;
    for (const g of allGenres) {
      const a = myMap[g] ?? 0;
      const b = theirMap[g] ?? 0;
      sumMin += Math.min(a, b);
      sumMax += Math.max(a, b);
    }

    const score = sumMax === 0 ? 0 : Math.round((sumMin / sumMax) * 100);

    // Shared genres (present in both with count > 0), sorted by min count desc
    const sharedGenres = [...allGenres]
      .filter((g) => (myMap[g] ?? 0) > 0 && (theirMap[g] ?? 0) > 0)
      .sort((a, b) => Math.min(theirMap[b] ?? 0, myMap[b] ?? 0) - Math.min(theirMap[a] ?? 0, myMap[a] ?? 0))
      .slice(0, 3);

    const myTopGenre = Object.entries(myMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const theirTopGenre = Object.entries(theirMap).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    res.json({ score, sharedGenres, myTopGenre, theirTopGenre });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

**Step 2: Verify TypeScript**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/server && npx tsc --noEmit 2>&1
```

**Step 3: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add server/src/routes/users.ts && git commit -m "feat: GET /api/users/:username/compatibility — weighted genre Jaccard score"
```

---

## Task 4: Frontend API clients

**Files:**
- Modify: `client/src/api/users.ts`

**Step 1: Read `client/src/api/users.ts` to find where to append**

**Step 2: Add two methods to the `usersApi` object**

```ts
  getTopGenres: (username: string) =>
    api.get(`/api/users/${username}/top-genres`).then((r) => r.data as {
      connected: boolean;
      genres?: Array<{ name: string; count: number; percentage: number }>;
    }),
  getCompatibility: (username: string) =>
    api.get(`/api/users/${username}/compatibility`).then((r) => r.data as {
      score: number;
      sharedGenres: string[];
      myTopGenre: string | null;
      theirTopGenre: string | null;
    }),
```

**Step 3: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

**Step 4: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/api/users.ts && git commit -m "feat: usersApi.getTopGenres + getCompatibility frontend clients"
```

---

## Task 5: GenreRadar component

**Files:**
- Create: `client/src/components/GenreRadar.tsx`

SVG radar/spider chart with pentagon axes. No external libraries. Uses CSS transition for the mount animation.

**Step 1: Create the file with this exact content**

```tsx
interface Genre {
  name: string;
  percentage: number;
}

interface Props {
  genres: Genre[];
}

const SIZE = 200;
const CX = 100;
const CY = 105;
const MAX_R = 72;
const LABEL_R = 90;
const N = 5;

function angle(i: number) {
  // Start from top (-90°), go clockwise every 72°
  return ((2 * Math.PI * i) / N) - Math.PI / 2;
}

function axisPoint(i: number, fraction: number) {
  const a = angle(i);
  return { x: CX + MAX_R * fraction * Math.cos(a), y: CY + MAX_R * fraction * Math.sin(a) };
}

function polygonPoints(fractions: number[]) {
  return fractions
    .map((f, i) => { const p = axisPoint(i, f); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; })
    .join(' ');
}

function gridLevel(fraction: number) {
  return polygonPoints(Array(N).fill(fraction));
}

export default function GenreRadar({ genres }: Props) {
  if (genres.length === 0) return null;

  // Pad to N entries so indices always align
  const padded = [...genres];
  while (padded.length < N) padded.push({ name: '', percentage: 0 });

  const dataPoints = polygonPoints(padded.map((g) => g.percentage / 100));

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE + 10}`}
        width="100%"
        style={{ maxWidth: 260 }}
        className="overflow-visible"
      >
        {/* Grid rings at 25 / 50 / 75 / 100% */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={gridLevel(f)}
            fill="none"
            stroke="#333333"
            strokeWidth={f === 1 ? 1 : 0.6}
            strokeDasharray={f === 1 ? 'none' : '3 2'}
          />
        ))}

        {/* Axis spokes */}
        {Array.from({ length: N }).map((_, i) => {
          const end = axisPoint(i, 1);
          return (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={end.x.toFixed(2)} y2={end.y.toFixed(2)}
              stroke="#333333"
              strokeWidth={0.6}
            />
          );
        })}

        {/* Data polygon — filled */}
        <polygon
          points={dataPoints}
          fill="rgba(245,158,11,0.22)"
          stroke="#f59e0b"
          strokeWidth={1.8}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.45))' }}
        />

        {/* Vertex dots */}
        {padded.map((g, i) => {
          if (!g.name) return null;
          const p = axisPoint(i, g.percentage / 100);
          return <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={3} fill="#f59e0b" />;
        })}

        {/* Axis labels */}
        {padded.map((g, i) => {
          if (!g.name) return null;
          const a = angle(i);
          const lx = CX + LABEL_R * Math.cos(a);
          const ly = CY + LABEL_R * Math.sin(a);
          // Anchor based on x position
          const anchor = lx < CX - 4 ? 'end' : lx > CX + 4 ? 'start' : 'middle';
          return (
            <text
              key={i}
              x={lx.toFixed(2)}
              y={ly.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={8.5}
              fill="#e5e7eb"
              fontFamily="inherit"
            >
              {g.name.length > 14 ? g.name.slice(0, 13) + '…' : g.name}
            </text>
          );
        })}

        {/* Percentage labels at each vertex */}
        {padded.map((g, i) => {
          if (!g.name || g.percentage === 0) return null;
          const p = axisPoint(i, g.percentage / 100);
          const a = angle(i);
          const ox = Math.cos(a) * 9;
          const oy = Math.sin(a) * 9;
          return (
            <text
              key={`pct-${i}`}
              x={(p.x + ox).toFixed(2)}
              y={(p.y + oy).toFixed(2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill="#f59e0b"
              fontFamily="inherit"
              fontWeight="bold"
            >
              {g.percentage}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

**Step 3: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/components/GenreRadar.tsx && git commit -m "feat: GenreRadar SVG component — pentagon radar chart for genre taste profile"
```

---

## Task 6: CompatibilityMeter component

**Files:**
- Create: `client/src/components/CompatibilityMeter.tsx`

SVG semicircle gauge. Arc starts at 225° (bottom-left), sweeps clockwise 270° to 135° (bottom-right). Score fills the arc proportionally.

```tsx
interface Props {
  score: number;
  sharedGenres: string[];
  myTopGenre: string | null;
  theirTopGenre: string | null;
  theirUsername: string;
}

const CX = 100;
const CY = 108;
const R = 72;
const SW = 11;        // stroke width
const START = 225;    // degrees (SVG: 0° = right)
const SPAN = 270;     // total arc degrees

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, spanDeg: number) {
  if (spanDeg <= 0) return '';
  // Cap at just under full circle to avoid degenerate path
  const safeDeg = Math.min(spanDeg, 359.99);
  const endDeg = startDeg + safeDeg;
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = safeDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function scoreColor(score: number): string {
  if (score >= 65) return '#f59e0b';        // amber — great match
  if (score >= 35) return '#fb923c';        // orange — decent
  return '#6b7280';                         // muted — low match
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Excellent match!';
  if (score >= 55) return 'Good vibes';
  if (score >= 35) return 'Some overlap';
  return 'Different tastes';
}

export default function CompatibilityMeter({ score, sharedGenres, myTopGenre, theirTopGenre, theirUsername }: Props) {
  const fillSpan = (score / 100) * SPAN;
  const color = scoreColor(score);

  return (
    <div className="rounded-2xl border border-vinyl-border/60 bg-vinyl-surface p-5 space-y-2">
      <p className="text-xs text-vinyl-muted text-center tracking-widest uppercase">Taste Match</p>

      <svg viewBox="0 0 200 155" width="100%" style={{ maxWidth: 220, display: 'block', margin: '0 auto' }}>
        {/* Background track */}
        <path
          d={arcPath(CX, CY, R, START, SPAN)}
          fill="none"
          stroke="#333333"
          strokeWidth={SW}
          strokeLinecap="round"
        />

        {/* Score arc */}
        {fillSpan > 0 && (
          <path
            d={arcPath(CX, CY, R, START, fillSpan)}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
          />
        )}

        {/* Score number */}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={34}
          fontWeight="bold"
          fill={color}
          fontFamily="inherit"
        >
          {score}
        </text>
        <text
          x={CX}
          y={CY + 22}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#6b7280"
          fontFamily="inherit"
        >
          {scoreLabel(score)}
        </text>

        {/* 0 and 100 labels */}
        {(() => {
          const s = polar(CX, CY, R + SW / 2 + 6, START);
          const e = polar(CX, CY, R + SW / 2 + 6, START + SPAN);
          return (
            <>
              <text x={s.x.toFixed(2)} y={s.y.toFixed(2)} textAnchor="end" fontSize={7} fill="#6b7280" fontFamily="inherit">0</text>
              <text x={e.x.toFixed(2)} y={e.y.toFixed(2)} textAnchor="start" fontSize={7} fill="#6b7280" fontFamily="inherit">100</text>
            </>
          );
        })()}
      </svg>

      {sharedGenres.length > 0 && (
        <p className="text-xs text-center text-vinyl-muted">
          You both love{' '}
          <span className="text-vinyl-amber font-medium">
            {sharedGenres.join(', ')}
          </span>
        </p>
      )}

      {(myTopGenre || theirTopGenre) && (
        <div className="flex justify-between text-[10px] text-vinyl-muted pt-1">
          {myTopGenre && <span>You: <span className="text-vinyl-text">{myTopGenre}</span></span>}
          {theirTopGenre && <span>{theirUsername}: <span className="text-vinyl-text">{theirTopGenre}</span></span>}
        </div>
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

**Step 3: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/components/CompatibilityMeter.tsx && git commit -m "feat: CompatibilityMeter SVG gauge component"
```

---

## Task 7: Update Profile.tsx

**Files:**
- Modify: `client/src/pages/Profile.tsx`

Add three things:
1. Import `GenreRadar` and `CompatibilityMeter`
2. Two new queries: `getTopGenres` and `getCompatibility`
3. Two new sections in the JSX

**Step 1: Add imports at the top of `Profile.tsx`**

After the existing imports, add:
```tsx
import GenreRadar from '../components/GenreRadar';
import CompatibilityMeter from '../components/CompatibilityMeter';
```

**Step 2: Add two queries inside the component body (after the existing `recentReviews` query)**

```tsx
const { data: topGenresData } = useQuery({
  queryKey: ['top-genres', username],
  queryFn: () => usersApi.getTopGenres(username!),
  enabled: !!username,
  staleTime: 10 * 60 * 1000,
});

const { data: compatibility } = useQuery({
  queryKey: ['compatibility', username],
  queryFn: () => usersApi.getCompatibility(username!),
  enabled: !!me && !!username && !isMe,
  staleTime: 5 * 60 * 1000,
});
```

**Step 3: Add GenreRadar section**

In the JSX, insert this block **between** the profile header (`</div>` closing the header flex) and the "Want to Listen" section:

```tsx
{/* Genre Taste Profile */}
{topGenresData?.connected === true && topGenresData.genres && topGenresData.genres.length > 0 && (
  <div className="rounded-2xl border border-vinyl-border/60 bg-vinyl-surface p-5">
    <div className="flex items-baseline gap-2 mb-3">
      <h2 className="text-base font-bold text-vinyl-text">Genre Profile</h2>
      <span className="text-xs text-vinyl-muted">· last 4 weeks</span>
    </div>
    <GenreRadar genres={topGenresData.genres} />
  </div>
)}
{topGenresData?.connected === false && isMe && (
  <div className="rounded-xl border border-dashed border-vinyl-border p-6 text-center text-sm text-vinyl-muted">
    <Link to="/settings" className="text-vinyl-amber hover:underline">Connect Spotify</Link>
    {' '}to see your genre profile
  </div>
)}
```

**Step 4: Add CompatibilityMeter section**

Insert this block immediately after the GenreRadar section (still before Want to Listen):

```tsx
{/* Compatibility — shown to other logged-in users */}
{!isMe && me && compatibility && (
  <CompatibilityMeter
    score={compatibility.score}
    sharedGenres={compatibility.sharedGenres}
    myTopGenre={compatibility.myTopGenre}
    theirTopGenre={compatibility.theirTopGenre}
    theirUsername={username!}
  />
)}
```

**Step 5: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

**Step 6: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/pages/Profile.tsx && git commit -m "feat: add GenreRadar and CompatibilityMeter to Profile page"
```

---

## Task 8: Update Home.tsx — Friends/Community feed toggle

**Files:**
- Modify: `client/src/pages/Home.tsx`

Replace the static "Your Feed" header with a Friends | Community tab toggle. Community shows a New/Hot sub-toggle.

**Step 1: Replace the entire content of `client/src/pages/Home.tsx` with:**

```tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { reviewsApi } from '../api/reviews';
import { spotifyApi } from '../api/spotify';
import ReviewCard from '../components/ReviewCard';
import HorizontalShelf from '../components/HorizontalShelf';
import { Link } from 'react-router-dom';

type FeedMode = 'friends' | 'community';
type CommunitySort = 'new' | 'hot';

export default function Home() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;
  const [feedMode, setFeedMode] = useState<FeedMode>('friends');
  const [communitySort, setCommunitySort] = useState<CommunitySort>('new');

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user && feedMode === 'friends',
  });

  const { data: communityReviews, isLoading: communityLoading } = useQuery({
    queryKey: ['community', communitySort],
    queryFn: () => reviewsApi.getCommunity(communitySort),
    enabled: feedMode === 'community',
    staleTime: 2 * 60 * 1000,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const recentAlbums = (recentlyPlayed ?? []).slice(0, 15).map((r) => ({
    spotifyAlbumId: r.albumId,
    name: r.albumName,
    artist: r.artist,
    coverUrl: r.coverUrl,
    releaseYear: 0,
    genres: [],
  }));

  const isLoading = feedMode === 'friends' ? feedLoading : communityLoading;

  return (
    <div className="space-y-6">
      {/* Your Recent Plays — only shown when Spotify is connected */}
      {spotifyConnected && recentAlbums.length > 0 && (
        <HorizontalShelf
          albums={recentAlbums}
          title="Your Recent Plays"
          subtitle="· From your Spotify"
        />
      )}

      {/* Feed toggle: Friends | Community */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
          {(['friends', 'community'] as FeedMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFeedMode(mode)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors capitalize ${
                feedMode === mode
                  ? 'bg-vinyl-amber text-black'
                  : 'text-vinyl-muted hover:text-vinyl-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* New/Hot sub-toggle — only visible in Community mode */}
        {feedMode === 'community' && (
          <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
            {(['new', 'hot'] as CommunitySort[]).map((s) => (
              <button
                key={s}
                onClick={() => setCommunitySort(s)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  communitySort === s
                    ? 'bg-vinyl-amber text-black'
                    : 'text-vinyl-muted hover:text-vinyl-text'
                }`}
              >
                {s === 'hot' ? '🔥 Hot' : '✨ New'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feed content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />
          ))}
        </div>
      ) : feedMode === 'friends' ? (
        feed && feed.length > 0 ? (
          <div className="space-y-4">
            {feed.map((review: any) => (
              <ReviewCard key={review.id} review={review} showAlbum />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center space-y-3">
            <span className="text-5xl block">🎵</span>
            <p className="text-vinyl-text font-medium">Your feed is empty</p>
            <p className="text-vinyl-muted text-sm">Add friends to see their reviews here.</p>
            <Link
              to="/friends"
              className="inline-block mt-2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
            >
              Find Friends
            </Link>
          </div>
        )
      ) : (
        communityReviews && communityReviews.length > 0 ? (
          <div className="space-y-4">
            {communityReviews.slice(0, 20).map((review: any) => (
              <ReviewCard key={review.id} review={review} showAlbum />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center text-sm text-vinyl-muted">
            No reviews yet.
          </div>
        )
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

**Step 3: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/pages/Home.tsx && git commit -m "feat: Friends/Community feed toggle with New/Hot sub-sort on Home"
```

---

## Task 9: Remove CommunityFeed from Discover.tsx

**Files:**
- Modify: `client/src/pages/Discover.tsx`

Community feed now lives on Home. Remove it from Discover entirely.

**Step 1: Read `client/src/pages/Discover.tsx`**

**Step 2: Remove all of the following**

- The `communitySort` state (`useState<'new' | 'hot'>`)
- The `communityReviews` query (`useQuery` with `queryKey: ['community', ...]`)
- The `COMMUNITY_FEED_LIMIT` constant
- The `CommunityFeed` function component definition
- All `<CommunityFeed .../>` usages in JSX (both branches)
- The `reviewsApi` import if it's no longer used after removal
- The `ReviewCard` import if it's no longer used after removal

**Step 3: TypeScript check**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar/client && npx tsc --noEmit 2>&1
```

Fix any unused-import errors.

**Step 4: Commit**

```bash
cd /c/Users/ASUS/Desktop/claudelaeneteresanmacerealar && git add client/src/pages/Discover.tsx && git commit -m "refactor: remove CommunityFeed from Discover (moved to Home)"
```

---

## Done

All 9 tasks complete. Verify end-to-end:

1. Home page: pill toggle switches between Friends feed and Community (New/Hot)
2. Profile page: genre radar pentagon chart shows (if Spotify connected), compatibility meter shows when viewing others
3. Discover page: no Community section
