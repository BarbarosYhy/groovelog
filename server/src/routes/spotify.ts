import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const SCOPES = 'user-read-recently-played';

// Redirect user to Spotify OAuth consent screen
// Token is passed as query param because browsers don't send custom headers on redirects
router.get('/connect', (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'No token provided' }); return; }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const state = payload.id;
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: process.env.SPOTIFY_CLIENT_ID!,
      scope: SCOPES,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      state,
    });
    res.redirect(`https://accounts.spotify.com/authorize?${params}`);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Handle OAuth callback from Spotify
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;
  const clientUrl = process.env.CLIENT_URL!;

  if (error || !code || !state) {
    res.redirect(`${clientUrl}/spotify-error`);
    return;
  }

  try {
    const creds = Buffer.from(
      `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    });

    if (!tokenRes.ok) {
      res.redirect(`${clientUrl}/spotify-error`);
      return;
    }

    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    // Get Spotify user ID
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      res.redirect(`${clientUrl}/spotify-error`);
      return;
    }
    const profile = (await profileRes.json()) as { id: string };

    // Save tokens to DB (state = userId from JWT)
    await prisma.user.update({
      where: { id: state },
      data: {
        spotifyId: profile.id,
        spotifyAccessToken: tokens.access_token,
        spotifyRefreshToken: tokens.refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      },
    });

    res.redirect(`${clientUrl}/spotify-success`);
  } catch {
    res.redirect(`${clientUrl}/spotify-error`);
  }
});

// Get recently played albums for the authenticated user
router.get('/recently-played', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        spotifyAccessToken: true,
        spotifyRefreshToken: true,
        spotifyTokenExpiry: true,
      },
    });

    if (!user?.spotifyAccessToken) {
      res.status(400).json({ error: 'Spotify not connected' });
      return;
    }

    let accessToken = user.spotifyAccessToken;

    // Refresh token if expired or about to expire (60s buffer)
    if (!user.spotifyTokenExpiry || user.spotifyTokenExpiry < new Date(Date.now() + 60_000)) {
      const creds = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64');
      const refreshRes = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${creds}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.spotifyRefreshToken!,
        }),
      });
      if (!refreshRes.ok) {
        res.status(401).json({ error: 'Spotify token refresh failed. Please reconnect.' });
        return;
      }
      const refreshed = (await refreshRes.json()) as {
        access_token: string;
        expires_in: number;
      };
      accessToken = refreshed.access_token;
      await prisma.user.update({
        where: { id: req.user!.id },
        data: {
          spotifyAccessToken: refreshed.access_token,
          spotifyTokenExpiry: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    }

    const recentRes = await fetch(
      'https://api.spotify.com/v1/me/player/recently-played?limit=50',
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!recentRes.ok) {
      res.status(502).json({ error: 'Failed to fetch Spotify history' });
      return;
    }

    const data = (await recentRes.json()) as {
      items: Array<{
        track: { album: { id: string; name: string } };
        played_at: string;
      }>;
    };

    // Deduplicate by album — keep most recent play per album
    const seen = new Set<string>();
    const result = data.items
      .filter((item) => {
        if (seen.has(item.track.album.id)) return false;
        seen.add(item.track.album.id);
        return true;
      })
      .map((item) => ({
        albumId: item.track.album.id,
        albumName: item.track.album.name,
        playedAt: item.played_at,
      }));

    res.json(result);
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Disconnect Spotify — clear all Spotify fields from user
router.delete('/disconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        spotifyId: null,
        spotifyAccessToken: null,
        spotifyRefreshToken: null,
        spotifyTokenExpiry: null,
      },
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
