import { Router, Request, Response } from 'express';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

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
        where: { userId: user.id, reviewableType: 'album', rating: { not: null as any } },
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

export default router;
