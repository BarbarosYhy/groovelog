import request from 'supertest';
import app from '../app';
import { prisma } from '../db/client';

afterAll(() => prisma.$disconnect());

describe('GET /api/albums/search', () => {
  it('returns 400 without q param', async () => {
    const res = await request(app).get('/api/albums/search');
    expect(res.status).toBe(400);
  });

  it('returns album results for a query', async () => {
    const res = await request(app).get('/api/albums/search?q=radiohead');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0]).toHaveProperty('spotifyAlbumId');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('artist');
    }
  }, 10000);
});
