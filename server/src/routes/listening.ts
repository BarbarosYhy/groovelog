import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const listSchema = z.object({
  spotifyAlbumId: z.string(),
  status: z.enum(['want', 'listened']),
});

router.post('/list', requireAuth, async (req: AuthRequest, res: Response) => {
  const parse = listSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const item = await prisma.listeningList.upsert({
      where: { userId_spotifyAlbumId: { userId: req.user!.id, spotifyAlbumId: parse.data.spotifyAlbumId } },
      update: { status: parse.data.status },
      create: { userId: req.user!.id, ...parse.data },
    });
    res.json(item);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:userId', async (req: AuthRequest, res: Response) => {
  try {
    const lists = await prisma.listeningList.findMany({
      where: { userId: req.params.userId },
      include: { album: true },
      orderBy: { addedAt: 'desc' },
    });
    res.json(lists);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

const logSchema = z.object({
  spotifyAlbumId: z.string(),
  listenedOn: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

router.post('/log', requireAuth, async (req: AuthRequest, res: Response) => {
  const parse = logSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const log = await prisma.listenLog.create({
      data: { userId: req.user!.id, ...parse.data, listenedOn: new Date(parse.data.listenedOn) },
    });
    res.status(201).json(log);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
