import { Router, Response } from 'express';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Get friendship status with a specific user
router.get('/status/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const otherId = req.params.userId;
  const myId = req.user!.id;
  if (otherId === myId) { res.json({ status: 'self' }); return; }
  try {
    const f = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: myId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: myId },
        ],
      },
    });
    if (!f) { res.json({ status: 'none' }); return; }
    if (f.status === 'accepted') { res.json({ status: 'friends' }); return; }
    // pending
    if (f.requesterId === myId) {
      res.json({ status: 'pending_sent' });
    } else {
      res.json({ status: 'pending_received', friendshipId: f.id });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get my friends list (accepted)
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const myId = req.user!.id;
  try {
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'accepted',
        OR: [{ requesterId: myId }, { addresseeId: myId }],
      },
      include: {
        requester: { select: { id: true, username: true, avatarUrl: true } },
        addressee: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    const friends = friendships.map((f) =>
      f.requesterId === myId ? f.addressee : f.requester
    );
    res.json(friends);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending incoming requests
router.get('/requests', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const requests = await prisma.friendship.findMany({
      where: { addresseeId: req.user!.id, status: 'pending' },
      include: {
        requester: { select: { id: true, username: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(requests.map((r) => ({ friendshipId: r.id, ...r.requester, createdAt: r.createdAt })));
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Send friend request
router.post('/request/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const addresseeId = req.params.userId;
  const requesterId = req.user!.id;
  if (addresseeId === requesterId) { res.status(400).json({ error: 'Cannot friend yourself' }); return; }
  try {
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });
    if (existing) {
      res.status(409).json({ error: 'Friendship already exists or is pending' });
      return;
    }
    const friendship = await prisma.friendship.create({
      data: { requesterId, addresseeId, status: 'pending' },
    });
    res.status(201).json({ ok: true, friendshipId: friendship.id });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Accept friend request
router.post('/accept/:friendshipId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const friendship = await prisma.friendship.findUnique({
      where: { id: req.params.friendshipId },
    });
    if (!friendship || friendship.addresseeId !== req.user!.id) {
      res.status(404).json({ error: 'Request not found' });
      return;
    }
    if (friendship.status !== 'pending') {
      res.status(400).json({ error: 'Not a pending request' });
      return;
    }
    await prisma.friendship.update({
      where: { id: req.params.friendshipId },
      data: { status: 'accepted' },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

// Decline / cancel / unfriend
router.delete('/:userId', requireAuth, async (req: AuthRequest, res: Response) => {
  const otherId = req.params.userId;
  const myId = req.user!.id;
  try {
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: myId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: myId },
        ],
      },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
