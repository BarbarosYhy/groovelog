import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getSpotifyPlaylist, getAlbum, normalizeAlbum } from '../spotify/client';

const router = Router();

const createSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coverUrl: z.string().url().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parse = createSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const playlist = await prisma.playlist.create({
      data: { userId: req.user!.id, type: 'curated', ...parse.data },
    });
    res.status(201).json(playlist);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await prisma.playlist.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        items: { include: { album: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!playlist) { res.status(404).json({ error: 'Not found' }); return; }
    const reviews = await prisma.review.findMany({
      where: { reviewableType: 'playlist', reviewableId: req.params.id },
      include: { user: { select: { id: true, username: true, avatarUrl: true } }, _count: { select: { likes: true, comments: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ ...playlist, reviews });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const playlist = await prisma.playlist.findUnique({ where: { id: req.params.id } });
    if (!playlist) { res.status(404).json({ error: 'Not found' }); return; }
    if (playlist.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    const updated = await prisma.playlist.update({ where: { id: req.params.id }, data: req.body });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/items', requireAuth, async (req: AuthRequest, res: Response) => {
  const { spotifyAlbumId } = req.body;
  if (!spotifyAlbumId) { res.status(400).json({ error: 'spotifyAlbumId required' }); return; }
  try {
    const count = await prisma.playlistItem.count({ where: { playlistId: req.params.id } });
    await prisma.albumCache.upsert({
      where: { spotifyAlbumId },
      update: {},
      create: normalizeAlbum(await getAlbum(spotifyAlbumId)),
    });
    const item = await prisma.playlistItem.create({
      data: { playlistId: req.params.id, spotifyAlbumId, position: count + 1 },
      include: { album: true },
    });
    res.status(201).json(item);
  } catch {
    res.status(502).json({ error: 'Failed to add item' });
  }
});

router.post('/import', requireAuth, async (req: AuthRequest, res: Response) => {
  const { spotifyPlaylistId } = req.body;
  if (!spotifyPlaylistId) { res.status(400).json({ error: 'spotifyPlaylistId required' }); return; }
  try {
    const spPlaylist = await getSpotifyPlaylist(spotifyPlaylistId) as any;
    const playlist = await prisma.playlist.create({
      data: {
        userId: req.user!.id,
        type: 'spotify_import',
        spotifyPlaylistId,
        title: spPlaylist.name,
        description: spPlaylist.description,
        coverUrl: spPlaylist.images?.[0]?.url,
      },
    });
    const tracks = spPlaylist.tracks?.items ?? [];
    let position = 1;
    for (const item of tracks) {
      const albumId = item?.track?.album?.id;
      if (!albumId) continue;
      await prisma.albumCache.upsert({
        where: { spotifyAlbumId: albumId },
        update: {},
        create: normalizeAlbum(item.track.album),
      });
      await prisma.playlistItem.create({
        data: { playlistId: playlist.id, spotifyAlbumId: albumId, position: position++ },
      });
    }
    res.status(201).json(playlist);
  } catch (err) {
    res.status(502).json({ error: 'Spotify import failed' });
  }
});

export default router;
