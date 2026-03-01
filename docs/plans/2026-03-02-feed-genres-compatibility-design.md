# Feed Toggle, Genre Radar & Compatibility Meter — Design

## Feature 1: Home Feed Friends/Community Toggle

Replace the static "Your Feed" header with a pill toggle: **Friends | Community**.

- **Friends tab**: existing friends-based feed (unchanged)
- **Community tab**: New/Hot sub-toggle appears → calls `reviewsApi.getCommunity(sort)`
- Remove `CommunityFeed` from `Discover.tsx` entirely

UI: pill toggle styled `bg-vinyl-surface border border-vinyl-border p-1 rounded-xl`, active tab `bg-vinyl-amber text-black rounded-lg`.

---

## Feature 2: Genre Radar Chart on Profile

### Backend: `GET /api/users/:username/top-genres`

- Looks up the profile user's stored Spotify OAuth token via `getUserSpotifyToken(userId)`
- Calls Spotify `/me/top/tracks?time_range=short_term&limit=50` with their token
- Extracts unique artist IDs from the tracks
- Calls Spotify `/v1/artists?ids=...` (batch, max 50) to get artist genres
- Aggregates genre counts across all artists, returns top 5 with percentages
- If user has no Spotify token: returns `{ connected: false }`

Response shape:
```json
{
  "connected": true,
  "genres": [
    { "name": "pop", "count": 12, "percentage": 38 },
    { "name": "indie", "count": 8, "percentage": 25 },
    ...
  ]
}
```

### Frontend: `GenreRadar.tsx` component

SVG-based radar/spider chart — no external libraries.

- Pentagon with 5 axes radiating from center
- Each axis = one genre
- Concentric pentagon grid at 25%, 50%, 75%, 100% (subtle `vinyl-border` lines)
- Filled polygon: `fill: rgba(245,158,11,0.2)` + `stroke: #f59e0b` stroke
- Genre names at axis tips
- Percentage values at each polygon vertex
- Mount animation: polygon scales from 0 to full size (`transform-origin: center`, CSS scale transition)
- If `connected: false`: show "Connect Spotify to see your genre profile"

Used in `Profile.tsx` in a dedicated section between stats and Want to Listen list.

---

## Feature 3: Compatibility Meter on Friend Profiles

### Backend: `GET /api/users/:username/compatibility` (auth required)

- Fetches both users' album reviews → joins AlbumCache.genres
- Builds genre→count frequency maps for each user
- **Weighted Jaccard similarity**: `score = Σmin(a[g], b[g]) / Σmax(a[g], b[g]) × 100`
- Returns:
```json
{
  "score": 78,
  "sharedGenres": ["indie", "alternative"],
  "myTopGenre": "pop",
  "theirTopGenre": "indie"
}
```

### Frontend: `CompatibilityMeter.tsx` component

SVG-based VU meter / semicircle gauge:

- 270° arc (from ~225° to ~-45°), background track `vinyl-border`, foreground amber
- Arc fills proportionally to score (animated on mount)
- Large score number in center of arc (count-up animation from 0)
- Label: "Taste Match" below number
- Shared genres listed below: "You both love: indie, alternative"
- Only shown on other users' profiles (`!isMe && !!me`)
- No friendship requirement — shown to all logged-in viewers

Used in `Profile.tsx` in the profile header area, below friend/follow buttons.
