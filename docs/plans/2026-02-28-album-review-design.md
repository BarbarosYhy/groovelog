# Album Review App — Design Document
**Date:** 2026-02-28
**Status:** Approved

---

## Overview

A Letterboxd-style album review social platform. Users create accounts, search albums via Spotify, write half-star rated reviews with text, log listening history, curate playlists, and follow other users' activity.

---

## Architecture

**Pattern:** Monorepo — React SPA + Express REST API

```
album-review-app/
├── client/           # Vite + React 18 + TypeScript
│   └── src/
│       ├── pages/
│       ├── components/
│       ├── hooks/
│       └── api/      # Axios + React Query
├── server/           # Express + TypeScript
│   └── src/
│       ├── routes/
│       ├── middleware/
│       ├── db/       # Prisma + Postgres
│       └── spotify/  # Token management + search
└── docker-compose.yml
```

**Frontend stack:** Vite, React 18, TypeScript, TailwindCSS, React Query, React Router v6
**Backend stack:** Express, TypeScript, Prisma ORM, PostgreSQL, bcrypt, jsonwebtoken
**External API:** Spotify Web API — Client Credentials Flow (server-side, auto-refreshed)

---

## Visual Design

**Theme:** Dark, moody, vinyl-record aesthetic
- Dark backgrounds (#0d0d0d, #1a1a1a)
- Warm accent colors (amber/orange tones)
- Album art as hero imagery
- Half-star interactive star rating component
- Review cards: avatar, stars, excerpt, like/comment counts — Letterboxd style

---

## Database Schema (Prisma)

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  username      String    @unique
  passwordHash  String
  bio           String?
  avatarUrl     String?
  createdAt     DateTime  @default(now())
  reviews       Review[]
  comments      Comment[]
  following     Follow[]  @relation("follower")
  followers     Follow[]  @relation("following")
  listeningList ListeningList[]
  listenLog     ListenLog[]
  playlists     Playlist[]
  reviewLikes   ReviewLike[]
}

model Follow {
  followerId  String
  followingId String
  follower    User @relation("follower", fields: [followerId], references: [id])
  following   User @relation("following", fields: [followingId], references: [id])
  @@id([followerId, followingId])
}

model AlbumCache {
  spotifyAlbumId String   @id
  name           String
  artist         String
  releaseYear    Int
  coverUrl       String
  genres         String[]
  cachedAt       DateTime @default(now())
  reviews        Review[]
  listeningLists ListeningList[]
  listenLogs     ListenLog[]
  playlistItems  PlaylistItem[]
}

model Review {
  id              String    @id @default(cuid())
  userId          String
  reviewableType  String    // "album" | "playlist"
  reviewableId    String
  rating          Float     // 0.5 – 5.0 in 0.5 increments
  bodyText        String?
  listenDate      DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  user            User      @relation(fields: [userId], references: [id])
  album           AlbumCache? @relation(fields: [reviewableId], references: [spotifyAlbumId])
  comments        Comment[]
  likes           ReviewLike[]
}

model ReviewLike {
  userId   String
  reviewId String
  user     User   @relation(fields: [userId], references: [id])
  review   Review @relation(fields: [reviewId], references: [id])
  @@id([userId, reviewId])
}

model Comment {
  id        String   @id @default(cuid())
  reviewId  String
  userId    String
  bodyText  String
  createdAt DateTime @default(now())
  review    Review   @relation(fields: [reviewId], references: [id])
  user      User     @relation(fields: [userId], references: [id])
}

model ListeningList {
  id             String     @id @default(cuid())
  userId         String
  spotifyAlbumId String
  status         String     // "want" | "listened"
  addedAt        DateTime   @default(now())
  user           User       @relation(fields: [userId], references: [id])
  album          AlbumCache @relation(fields: [spotifyAlbumId], references: [spotifyAlbumId])
  @@unique([userId, spotifyAlbumId])
}

model ListenLog {
  id             String     @id @default(cuid())
  userId         String
  spotifyAlbumId String
  listenedOn     DateTime
  notes          String?
  user           User       @relation(fields: [userId], references: [id])
  album          AlbumCache @relation(fields: [spotifyAlbumId], references: [spotifyAlbumId])
}

model Playlist {
  id               String         @id @default(cuid())
  userId           String
  title            String
  description      String?
  type             String         // "curated" | "spotify_import"
  spotifyPlaylistId String?
  coverUrl         String?
  createdAt        DateTime       @default(now())
  user             User           @relation(fields: [userId], references: [id])
  items            PlaylistItem[]
}

model PlaylistItem {
  id             String     @id @default(cuid())
  playlistId     String
  spotifyAlbumId String
  position       Int
  playlist       Playlist   @relation(fields: [playlistId], references: [id])
  album          AlbumCache @relation(fields: [spotifyAlbumId], references: [spotifyAlbumId])
}
```

---

## Pages

| Route | Page | Purpose |
|---|---|---|
| `/` | Home / Feed | Activity feed from followed users |
| `/discover` | Discover | Search Spotify albums, trending reviews |
| `/album/:id` | Album Detail | Cover art hero, metadata, all reviews, avg rating, listen/list actions |
| `/playlist/:id` | Playlist Detail | Playlist albums, reviews of the playlist |
| `/review/new` | Write Review | Star picker, text editor, listen date |
| `/profile/:username` | User Profile | Reviews, lists, playlists, follow button |
| `/lists/:username` | Listening Lists | Want-to-listen / listened shelves |
| `/login` | Login | JWT auth |
| `/register` | Register | Account creation |

---

## API Routes

### Auth
```
POST /api/auth/register    → create user, return JWT
POST /api/auth/login       → validate credentials, return JWT
GET  /api/auth/me          → current user from JWT
```

### Albums (Spotify proxy)
```
GET /api/albums/search?q=  → search Spotify, cache results
GET /api/albums/:id        → album detail + avg rating
```

### Reviews
```
POST   /api/reviews               → create (auth)
GET    /api/reviews/album/:id     → all reviews for album
GET    /api/reviews/:id           → single review + comments
PUT    /api/reviews/:id           → edit (owner)
DELETE /api/reviews/:id           → delete (owner)
POST   /api/reviews/:id/like      → toggle like
```

### Comments
```
POST   /api/comments         → add comment (auth)
DELETE /api/comments/:id     → delete own comment
```

### Users
```
GET  /api/users/:username       → profile + stats
POST /api/users/:id/follow      → toggle follow (auth)
GET  /api/users/:id/feed        → activity feed of followed users
```

### Playlists
```
POST /api/playlists              → create (auth)
GET  /api/playlists/:id          → get playlist + items + reviews
PUT  /api/playlists/:id          → edit (owner)
POST /api/playlists/:id/items    → add album
POST /api/playlists/import       → import from Spotify playlist URL
```

### Listening
```
POST /api/listening/list       → add to want/listened list (auth)
GET  /api/listening/:userId    → get user's lists
POST /api/listening/log        → add listen log entry (auth)
```

---

## Auth Flow

1. Register: `POST /api/auth/register` → bcrypt hash password → create User → return JWT (7-day expiry)
2. Login: `POST /api/auth/login` → compare hash → return JWT
3. Protected routes: `Authorization: Bearer <token>` header → JWT middleware validates → attaches `req.user`

---

## Spotify Integration

- **Flow:** Client Credentials (no user OAuth needed — we just search public catalog)
- **Token:** Server fetches + caches access token, auto-refreshes before expiry
- **Album caching:** On first album view, fetch full metadata from Spotify and persist to `AlbumCache` table — subsequent loads skip Spotify entirely
- **Env vars needed:** `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
