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
