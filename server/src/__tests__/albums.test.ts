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
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty('spotifyAlbumId');
        expect(res.body[0]).toHaveProperty('name');
        expect(res.body[0]).toHaveProperty('artist');
      }
    }
  }, 10000);
});

describe('GET /api/albums/trending', () => {
  it('returns 200 with an array', async () => {
    const res = await request(app).get('/api/albums/trending');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('respects limit query param', async () => {
    const res = await request(app).get('/api/albums/trending?limit=3');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(3);
  });

  it('ignores negative limit and returns a safe result', async () => {
    const res = await request(app).get('/api/albums/trending?limit=-5');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(20);
  });
});
