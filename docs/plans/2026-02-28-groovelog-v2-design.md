# Groovelog v2 — Feature Design

Date: 2026-02-28

## Overview

Five features: review uniqueness enforcement, optional Spotify OAuth with recently-played auto-fill, "Want to Listen" UX fix, full UI redesign, and weekly trending albums on the home page.

---

## Feature 1 — One Review Per User Per Album

### Problem
No uniqueness constraint on `Review(userId, reviewableType, reviewableId)`. A user can post unlimited reviews for the same album.

### Solution

**Schema:** Add `@@unique([userId, reviewableType, reviewableId])` to the `Review` model. Run `prisma db push`.

**Backend:**
- `POST /api/reviews` — before creating, check for existing review; return 409 if found
- `GET /api/reviews/mine?albumId=X` — returns the authenticated user's review for that album (or 404)
- `PUT /api/reviews/:id` — already exists, used for editing

**Frontend:**
- `AlbumDetail` queries `GET /api/reviews/mine?albumId=X` on load
- If a review exists → show "Edit Review" button (links to `/review/new?albumId=X&reviewId=<id>`)
- If not → show "Write Review" button
- `WriteReview` reads `?reviewId` from URL; if present, loads existing review and submits via PUT

---

## Feature 2 — Spotify OAuth (Optional)

### Problem
No user-level Spotify connection. Listen date in review is manual. Users have no incentive to connect Spotify.

### Solution

**OAuth Flow:** Authorization Code Flow (not PKCE — server-side, secrets stay safe).
- Scope: `user-read-recently-played` only
- Redirect URI: `http://localhost:3001/api/auth/spotify/callback`

**Schema changes — User model:**
```
spotifyId           String?   @unique
spotifyAccessToken  String?
spotifyRefreshToken String?
spotifyTokenExpiry  DateTime?
```

**Backend routes:**
- `GET /api/auth/spotify` — builds Spotify OAuth URL with state param, redirects user
- `GET /api/auth/spotify/callback` — exchanges code for tokens, saves to DB, redirects to `CLIENT_URL/spotify-success`
- `GET /api/me/spotify/recently-played` — requireAuth, uses stored access token (auto-refresh if expired), calls `https://api.spotify.com/v1/me/player/recently-played`, returns list of `{ albumId, albumName, playedAt }`

**Frontend:**
- After register success, show "Connect Spotify" step with large Spotify-green button + "Skip for now" link
- `/spotify-success` route — shows success, redirects to home after 2s
- `AuthContext` stores `spotifyConnected: boolean` derived from `me` response
- `WriteReview` — if `spotifyConnected`, show "Fetch from Spotify" button next to listen date field; on click, calls `/api/me/spotify/recently-played`, finds matching album, pre-fills the date

**Spotify Dashboard setup required by user:**
Add `http://localhost:3001/api/auth/spotify/callback` as redirect URI in the Spotify Developer Dashboard.

---

## Feature 3 — "Want to Listen" UX Fix

### Problem
- Buttons shown to unauthenticated users; API call silently fails with 401
- No visual feedback after clicking — user doesn't know if it worked
- No link to the user's listening list

### Solution
- Hide "Want to Listen" / "Mark Listened" buttons from logged-out users; show "Log in to track" prompt instead
- After successful mutation: button gets a checkmark + active style (amber border, filled bg)
- On error: show inline error text under buttons
- Add link in user profile page to listening list (`/lists/:username`)

---

## Feature 4 — UI Redesign

### Design Principles
- Apple Music dark mode × Letterboxd aesthetic
- Keep vinyl color tokens (amber, bg, surface, border, muted, text)
- Add: generous whitespace, gradient overlays, glass-morphism navbar, blur effects
- Typography: tighter headings, lighter body text

### Component-by-component changes

**Navbar**
- Logo: `GROOVELOG` wordmark in bold italic, amber, larger
- Links spaced further, active link highlighted
- User: avatar circle with initials (amber bg), dropdown for profile/sign out

**Home**
- Two-section layout:
  - "This Week" — horizontal strip of 6 trending album cards (cover + artist + avg rating chip)
  - "Your Feed" — full-width review feed below
- Empty feed state: more engaging illustration-style empty state

**AlbumDetail Hero**
- Full-width blurred background derived from album cover (CSS `filter: blur` on `::before` pseudo or absolutely positioned img)
- Dark gradient overlay (`from-transparent to-vinyl-bg`)
- Album cover floated left, info right, on top of gradient
- Rating, review count, and action buttons in the hero area

**ReviewCard**
- Feed mode (`showAlbum=true`): album cover left (64px), text right — more horizontal layout
- Cleaner like/comment row with proper icon buttons (SVG not emoji)
- Subtle hover lift (`hover:border-vinyl-amber/30 hover:shadow-lg`)

**AlbumCard (Discover grid)**
- Cover image fills card
- On hover: dark overlay slides up from bottom with album name + artist + rating chip
- Smooth `transition-all duration-200`

**Discover**
- Hero search bar: centered, full-width input with search icon inside, large padding
- Results grid: 5 columns desktop / 3 tablet / 2 mobile (same as now but better cards)

**WriteReview**
- Cleaner two-column layout on desktop (album info left, form right)
- Star rating larger and more interactive
- Spotify fetch button styled in Spotify green

**Login / Register**
- Center card on full-screen bg with subtle vinyl record SVG pattern or gradient
- Better form spacing and label styles

---

## Feature 5 — Weekly Trending Albums

### Backend
`GET /api/albums/trending?limit=6`

Query: count reviews where `createdAt >= now - 7 days`, group by `reviewableId`, join `AlbumCache`, order by review count desc, include avg rating.

```sql
-- Prisma equivalent:
groupBy: ['reviewableId'],
having: { createdAt: { gte: sevenDaysAgo } },
_count: true,
orderBy: { _count: { id: 'desc' } }
```

Response: `Array<{ spotifyAlbumId, name, artist, coverUrl, reviewCount, avgRating }>`

### Frontend (Home)
- Above the feed: `<TrendingSection />` component
- Fetched with `useQuery({ queryKey: ['trending'] })`, no auth required
- Horizontal scrollable strip of 6 `<AlbumCard>` components
- Section header: "This Week" with subtle "·" separator and week date range
- Shows even for logged-out users on the `/` route (move `/` to public)

---

## Implementation Order (for plan)

1. Schema migration (unique constraint + Spotify fields) + `db push`
2. Backend: review uniqueness (`POST /reviews` guard + `GET /reviews/mine`)
3. Backend: trending endpoint
4. Backend: Spotify OAuth routes + recently-played endpoint
5. Frontend: review uniqueness (AlbumDetail + WriteReview edit mode)
6. Frontend: Want to Listen UX fix
7. Frontend: Trending section on Home
8. Frontend: Full UI redesign (all components + pages)
9. Frontend: Spotify connect flow (Register step + WriteReview fetch button)
