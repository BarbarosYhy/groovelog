import request from 'supertest';
import app from '../app';
import { prisma } from '../db/client';

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test-auth' } } });
  await prisma.$disconnect();
});

describe('POST /api/auth/register', () => {
  it('creates a user and returns a JWT', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-auth-1@example.com',
      username: 'testauth1',
      password: 'Password123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test-auth-1@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test-auth-dup@example.com',
      username: 'testauthdupa',
      password: 'Password123!',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'test-auth-dup@example.com',
      username: 'testauthdupb',
      password: 'Password123!',
    });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  beforeAll(async () => {
    // Ensure the login test user exists regardless of test order
    await request(app).post('/api/auth/register').send({
      email: 'test-auth-login@example.com',
      username: 'testauthlogin',
      password: 'Password123!',
    });
    // If already exists (from a prior run), the 409 is fine — user still exists
  });

  it('returns JWT on valid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-auth-login@example.com',
      password: 'Password123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'test-auth-login@example.com',
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/auth/me', () => {
  it('returns current user with valid token', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'test-auth-me@example.com',
      username: 'testauthme',
      password: 'Password123!',
    });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testauthme');
  });

  it('returns 401 with no token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
