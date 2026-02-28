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

  // Seed a fake album cache entry
  await prisma.albumCache.upsert({
    where: { spotifyAlbumId: TEST_ALBUM_ID },
    update: {},
    create: {
      spotifyAlbumId: TEST_ALBUM_ID,
      name: 'Test Album',
      artist: 'Test Artist',
      releaseYear: 2020,
      coverUrl: 'https://example.com/cover.jpg',
      genres: [],
    },
  });
});

afterAll(async () => {
  await prisma.review.deleteMany({ where: { reviewableId: TEST_ALBUM_ID } });
  await prisma.albumCache.deleteMany({ where: { spotifyAlbumId: TEST_ALBUM_ID } });
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
