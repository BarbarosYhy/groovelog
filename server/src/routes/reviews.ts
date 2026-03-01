import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const reviewSchema = z.object({
  reviewableType: z.enum(['album', 'playlist']),
  reviewableId: z.string(),
  rating: z.number().min(0.5).max(5).multipleOf(0.5),
  bodyText: z.string().max(5000).optional(),
  listenDate: z.string().datetime().optional(),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parse = reviewSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: parse.error.flatten() });
    return;
  }
  const { reviewableType, reviewableId, rating, bodyText, listenDate } = parse.data;
  try {
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
      res.status(409).json({ error: 'You have already reviewed this item' });
      return;
    }
    const review = await prisma.review.create({
      data: {
        userId: req.user!.id,
        reviewableType,
        reviewableId,
        rating,
        bodyText,
        listenDate: listenDate ? new Date(listenDate) : undefined,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
    });
    res.status(201).json(review);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

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

router.get('/album/:albumId', async (req: AuthRequest, res: Response) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { reviewableType: 'album', reviewableId: req.params.albumId },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true, comments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(reviews);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        comments: {
          include: { user: { select: { id: true, username: true, avatarUrl: true } } },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { likes: true } },
      },
    });
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json(review);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    if (review.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    const parse = reviewSchema.partial().safeParse(req.body);
    if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
    const updated = await prisma.review.update({ where: { id: req.params.id }, data: parse.data });
    res.json(updated);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const review = await prisma.review.findUnique({ where: { id: req.params.id } });
    if (!review) { res.status(404).json({ error: 'Not found' }); return; }
    if (review.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    await prisma.review.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.reviewLike.findUnique({
      where: { userId_reviewId: { userId: req.user!.id, reviewId: req.params.id } },
    });
    if (existing) {
      await prisma.reviewLike.delete({
        where: { userId_reviewId: { userId: req.user!.id, reviewId: req.params.id } },
      });
      res.json({ liked: false });
    } else {
      await prisma.reviewLike.create({ data: { userId: req.user!.id, reviewId: req.params.id } });
      res.json({ liked: true });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
