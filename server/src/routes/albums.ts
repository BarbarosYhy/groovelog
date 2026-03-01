import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { searchAlbums, getAlbum, normalizeAlbum, getTrendingAlbums, getAlbumTracks } from '../spotify/client';

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
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 6), 20);
  try {
    const albums = await getTrendingAlbums(limit);
    res.json(albums.map(normalizeAlbum));
  } catch {
    res.status(502).json({ error: 'Failed to fetch trending albums' });
  }
});

router.get('/:id/tracks', async (req: Request, res: Response) => {
  try {
    const tracks = await getAlbumTracks(req.params.id);
    res.json(tracks.map((t) => ({
      id: t.id,
      name: t.name,
      trackNumber: t.track_number,
      durationMs: t.duration_ms,
      discNumber: t.disc_number,
    })));
  } catch {
    res.status(502).json({ error: 'Failed to fetch tracks' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    let cached = await prisma.albumCache.findUnique({ where: { spotifyAlbumId: id } });
    if (!cached) {
      const album = await getAlbum(id);
      const normalized = normalizeAlbum(album);
      cached = await prisma.albumCache.upsert({
        where: { spotifyAlbumId: id },
        update: { cachedAt: new Date() },
        create: normalized,
      });
    }

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
  } catch {
    res.status(404).json({ error: 'Album not found' });
  }
});

export default router;
