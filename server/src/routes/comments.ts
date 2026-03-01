import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const commentSchema = z.object({
  reviewId: z.string(),
  bodyText: z.string().min(1).max(2000),
});

router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const parse = commentSchema.safeParse(req.body);
  if (!parse.success) { res.status(400).json({ error: parse.error.flatten() }); return; }
  try {
    const comment = await prisma.comment.create({
      data: { ...parse.data, userId: req.user!.id },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        _count: { select: { likes: true } },
      },
    });
    res.status(201).json(comment);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/like', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId: req.user!.id, commentId: req.params.id } },
    });
    if (existing) {
      await prisma.commentLike.delete({
        where: { userId_commentId: { userId: req.user!.id, commentId: req.params.id } },
      });
      res.json({ liked: false });
    } else {
      await prisma.commentLike.create({ data: { userId: req.user!.id, commentId: req.params.id } });
      res.json({ liked: true });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
    if (!comment) { res.status(404).json({ error: 'Not found' }); return; }
    if (comment.userId !== req.user!.id) { res.status(403).json({ error: 'Forbidden' }); return; }
    await prisma.comment.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
