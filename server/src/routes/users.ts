import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getUserSpotifyToken } from './spotify';

const router = Router();

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

router.get('/:username/want-list', async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    const items = await prisma.listeningList.findMany({
      where: { userId: user.id, status: 'want' },
      include: {
        album: {
          select: {
            spotifyAlbumId: true,
            name: true,
            artist: true,
            coverUrl: true,
            releaseYear: true,
          },
        },
      },
      orderBy: { addedAt: 'desc' },
    });
    res.json(items.map((i) => ({ ...i.album, addedAt: i.addedAt })));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
        albumCache: { select: { spotifyAlbumId: true, name: true, artist: true, coverUrl: true } },
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

    const timeRanges: Array<{ range: string; label: string }> = [
      { range: 'short_term', label: 'last 4 weeks' },
      { range: 'medium_term', label: 'last 6 months' },
      { range: 'long_term', label: 'all time' },
    ];

    // Use /me/top/artists directly — returns full artist objects with genres embedded.
    // This is more reliable than top/tracks → batch /artists, since top artists are
    // well-known enough that Spotify has genre tags for them.
    let topArtists: Array<{ genres: string[] }> = [];
    let timeLabel = 'last 4 weeks';

    for (const { range, label } of timeRanges) {
      const artistsRes = await fetch(
        `https://api.spotify.com/v1/me/top/artists?limit=50&time_range=${range}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!artistsRes.ok) { res.json({ connected: false }); return; }

      const artistsData = (await artistsRes.json()) as {
        items: Array<{ genres: string[] }>;
      };

      if (artistsData.items.length > 0) {
        topArtists = artistsData.items;
        timeLabel = label;
        break;
      }
    }

    if (topArtists.length === 0) { res.json({ connected: true, genres: [], timeLabel: 'last 4 weeks' }); return; }

    const counts: Record<string, number> = {};
    for (const artist of topArtists) {
      for (const genre of (artist.genres ?? [])) {
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

    res.json({ connected: true, genres: top5, timeLabel });
  } catch (err) {
    console.error('[top-genres]', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:username/compatibility', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const other = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: { id: true },
    });
    if (!other) { res.status(404).json({ error: 'User not found' }); return; }

    const myId = req.user!.id;
    const otherId = other.id;

    if (myId === otherId) {
      res.json({ score: 100, sharedGenres: [], myTopGenre: null, theirTopGenre: null });
      return;
    }

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
        where: { userId: user.id, reviewableType: 'album' },
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
      avgRating: avgRatingResult._avg?.rating ?? null,
      friendCount,
    });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/follow', requireAuth, async (req: AuthRequest, res: Response) => {
  const followingId = req.params.id;
  if (followingId === req.user!.id) { res.status(400).json({ error: 'Cannot follow yourself' }); return; }
  try {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: req.user!.id, followingId } },
    });
    if (existing) {
      await prisma.follow.delete({ where: { followerId_followingId: { followerId: req.user!.id, followingId } } });
      res.json({ following: false });
    } else {
      await prisma.follow.create({ data: { followerId: req.user!.id, followingId } });
      res.json({ following: true });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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
        albumCache: { select: { spotifyAlbumId: true, name: true, artist: true, coverUrl: true } },
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

export default router;
