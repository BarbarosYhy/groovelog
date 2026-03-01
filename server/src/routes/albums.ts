import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { searchAlbums, getAlbum, normalizeAlbum } from '../spotify/client';

const router = Router();

router.get('/search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) {
    res.status(400).json({ error: 'q parameter required' });
    return;
  }
  try {
    const results = await searchAlbums(q);
    res.json(results.map(normalizeAlbum));
  } catch (err) {
    res.status(502).json({ error: 'Spotify search failed' });
  }
});

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

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  // Try cache first
  let cached = await prisma.albumCache.findUnique({ where: { spotifyAlbumId: id } });
  if (!cached) {
    try {
      const album = await getAlbum(id);
      const normalized = normalizeAlbum(album);
      cached = await prisma.albumCache.upsert({
        where: { spotifyAlbumId: id },
        update: { cachedAt: new Date() },
        create: normalized,
      });
    } catch {
      res.status(404).json({ error: 'Album not found' });
      return;
    }
  }

  // Avg rating
  const agg = await prisma.review.aggregate({
    where: { reviewableType: 'album', reviewableId: id },
    _avg: { rating: true },
    _count: { id: true },
  });

  res.json({
    ...cached,
    avgRating: agg._avg.rating,
    reviewCount: agg._count.id,
  });
});

export default router;
