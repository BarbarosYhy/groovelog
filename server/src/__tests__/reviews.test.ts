import request from 'supertest';
import app from '../app';
import { prisma } from '../db/client';

let token: string;
let userId: string;
const TEST_ALBUM_ID = 'test-album-' + Date.now();

beforeAll(async () => {
  const res = await request(app).post('/api/auth/register').send({
    email: `review-test-${Date.now()}@example.com`,
    username: `reviewuser${Date.now()}`,
    password: 'Password123!',
  });
  token = res.body.token;
  userId = res.body.user.id;

  // Seed fake album cache entries
  const albumSeeds = [
    { spotifyAlbumId: TEST_ALBUM_ID, name: 'Test Album', artist: 'Test Artist' },
    { spotifyAlbumId: 'mine-test-album', name: 'Mine Test Album', artist: 'Test Artist' },
    { spotifyAlbumId: 'dup-test-album', name: 'Dup Test Album', artist: 'Test Artist' },
  ];
  for (const seed of albumSeeds) {
    await prisma.albumCache.upsert({
      where: { spotifyAlbumId: seed.spotifyAlbumId },
      update: {},
      create: {
        spotifyAlbumId: seed.spotifyAlbumId,
        name: seed.name,
        artist: seed.artist,
        releaseYear: 2020,
        coverUrl: 'https://example.com/cover.jpg',
        genres: [],
      },
    });
  }
});

afterAll(async () => {
  await prisma.review.deleteMany({
    where: { reviewableId: { in: [TEST_ALBUM_ID, 'mine-test-album', 'dup-test-album'] } },
  });
  await prisma.albumCache.deleteMany({
    where: { spotifyAlbumId: { in: [TEST_ALBUM_ID, 'mine-test-album', 'dup-test-album'] } },
  });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

let reviewId: string;

describe('POST /api/reviews', () => {
  it('creates a review (auth required)', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: TEST_ALBUM_ID, rating: 4.5, bodyText: 'Great album!' });
    expect(res.status).toBe(201);
    expect(res.body.rating).toBe(4.5);
    reviewId = res.body.id;
  });

  it('rejects invalid rating', async () => {
    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: TEST_ALBUM_ID, rating: 6 });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const res = await request(app).post('/api/reviews').send({ rating: 3 });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/reviews/album/:id', () => {
  it('returns reviews for an album', async () => {
    const res = await request(app).get(`/api/reviews/album/${TEST_ALBUM_ID}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('POST /api/reviews/:id/like', () => {
  it('toggles like on a review', async () => {
    const res = await request(app)
      .post(`/api/reviews/${reviewId}/like`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('liked');
  });
});

describe('GET /api/reviews/mine', () => {
  it('returns 401 if not authenticated', async () => {
    const res = await request(app).get('/api/reviews/mine?albumId=abc');
    expect(res.status).toBe(401);
  });

  it('returns 400 if albumId missing', async () => {
    const res = await request(app)
      .get('/api/reviews/mine')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 if no review exists', async () => {
    const res = await request(app)
      .get('/api/reviews/mine?albumId=nonexistent-album-xyz')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('returns existing review', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'mine-test-album', rating: 4 });

    const res = await request(app)
      .get('/api/reviews/mine?albumId=mine-test-album')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rating).toBe(4);
  });
});

describe('POST /api/reviews duplicate prevention', () => {
  it('returns 409 on duplicate review', async () => {
    await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'dup-test-album', rating: 3 });

    const res = await request(app)
      .post('/api/reviews')
      .set('Authorization', `Bearer ${token}`)
      .send({ reviewableType: 'album', reviewableId: 'dup-test-album', rating: 4 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already/i);
  });
});
