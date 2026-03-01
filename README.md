# Groovelog

A Letterboxd-style album review app. Log what you listen to, rate albums and tracks, read friends' reviews, and discover music together.

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 18, Vite, TypeScript, TailwindCSS |
| Backend | Node.js, Express, TypeScript |
| Database | PostgreSQL (Docker) + Prisma ORM |
| Auth | JWT (register/login with email or username) |
| Music data | Spotify Web API (OAuth + Client Credentials) |

---

## Features

- **Album reviews** — half-star ratings (0.5–5), body text, listen date
- **Track ratings** — rate individual tracks from the album page
- **Social feed** — see your friends' recent reviews in chronological order
- **Community feed** — all reviews sorted by New or Hot (most liked)
- **Friendship system** — send/accept/decline friend requests, friends list
- **Follow system** — follow users independently of friendship
- **Inline comments** — expand comments directly on any review card; like individual comments
- **Want to Listen** — bookmark albums to your listening list
- **Discover page** — your Spotify top albums, recent plays, friends' picks, community reviews
- **Spotify integration** — connect Spotify OAuth to see your personal listening history
- **Profile pages** — reviews, want-list, avg rating, friend/follower counts
- **Search** — find albums by name or artist

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for PostgreSQL)
- A [Spotify Developer app](https://developer.spotify.com/dashboard)

### 1. Clone and install

```bash
git clone https://github.com/BarbarosYhy/groovelog.git
cd groovelog

cd server && npm install
cd ../client && npm install
```

### 2. Start PostgreSQL

```bash
docker run -d \
  --name groovelog-db \
  -e POSTGRES_USER=albumuser \
  -e POSTGRES_PASSWORD=albumpass \
  -e POSTGRES_DB=albumreview \
  -p 5432:5432 \
  postgres:15
```

### 3. Configure environment

**`server/.env`**
```env
DATABASE_URL=postgresql://albumuser:albumpass@localhost:5432/albumreview
JWT_SECRET=your-random-hex-secret
SPOTIFY_CLIENT_ID=your-spotify-client-id
SPOTIFY_CLIENT_SECRET=your-spotify-client-secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3001/api/spotify/callback
```

> Spotify requires `127.0.0.1` — `localhost` is blocked by their OAuth.

**`client/.env`**
```env
VITE_API_URL=http://localhost:3001
```

### 4. Set up the database

```bash
cd server
npx prisma db push
npx prisma generate
```

### 5. Run

```bash
# Terminal 1 — backend
cd server && npm run dev   # http://localhost:3001

# Terminal 2 — frontend
cd client && npm run dev   # http://localhost:5173
```

---

## Project Structure

```
groovelog/
├── client/               # React + Vite frontend
│   └── src/
│       ├── api/          # Axios API clients
│       ├── components/   # AlbumCard, ReviewCard, StarRating, HorizontalShelf, Navbar
│       ├── context/      # AuthContext (JWT)
│       └── pages/        # Home, Discover, Search, Profile, Friends, AlbumDetail, …
│
└── server/               # Express backend
    ├── prisma/
    │   └── schema.prisma # 12 models
    └── src/
        ├── middleware/   # requireAuth (JWT)
        ├── routes/       # auth, albums, reviews, comments, users, friends, spotify, …
        └── spotify/      # Spotify API client with token management
```

---

## API Overview

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/register` | Create account |
| `POST /api/auth/login` | Login (email or username) |
| `GET /api/albums/search?q=` | Search Spotify albums |
| `GET /api/albums/:id` | Album detail + cache |
| `POST /api/reviews` | Submit a review |
| `GET /api/reviews/community?sort=new\|hot` | Community feed |
| `GET /api/users/:username` | User profile |
| `GET /api/users/:id/feed` | Friends' reviews feed |
| `GET /api/friends` | My friends list |
| `POST /api/friends/request/:userId` | Send friend request |
| `POST /api/comments/:id/like` | Toggle comment like |
| `GET /api/spotify/connect` | Start Spotify OAuth |

---

## Spotify Setup Notes

1. In your Spotify Developer Dashboard, add `http://127.0.0.1:3001/api/spotify/callback` as a Redirect URI.
2. Add the OAuth scopes: `user-read-recently-played user-top-read`.
3. Your app must be in **Development mode** — add your Spotify account email to the allowlist.
