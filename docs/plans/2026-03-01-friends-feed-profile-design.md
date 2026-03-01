# Groovelog — Friends Page, Feed & Profile Improvements

**Date:** 2026-03-01
**Status:** Approved

---

## Scope

Six focused changes to the existing Groovelog app:

1. Delete all user data (clean slate)
2. Friends page with user search
3. Profile recent reviews (fix placeholder)
4. Feed changed to friends-based
5. Track star rating click fix
6. Three new features (notifications badge, profile stats, friends shelf on Discover)

---

## 0. Delete All User Data

Prisma `deleteMany` on all user-generated tables in dependency order, preserving AlbumCache (Spotify data cache). Order: ReviewLike → Comment → Review → ListeningList → ListenLog → PlaylistItem → Playlist → Friendship → Follow → User.

---

## 1. Friends Page

### Route & Nav
- New route: `GET /friends` (protected, requires auth)
- Navbar: add "Friends" tab between Discover and Search, only rendered when `user` is logged in
- Badge on Friends tab showing count of pending incoming requests (fetched from `/api/friends/requests`)

### Backend
New endpoint added to `server/src/routes/users.ts` (before `/:username`):
```
GET /api/users/search?q=<username>
→ [{id, username, avatarUrl}]  (limit 10, case-insensitive prefix match)
```

### Frontend — `client/src/pages/Friends.tsx`
Three sections:
1. **Search bar** — text input, debounced or on-submit, calls `/api/users/search?q=`, shows results with Add Friend button (calls existing `friendsApi.sendRequest`)
2. **Pending Requests** — incoming requests from `/api/friends/requests`, each has Accept / Decline buttons
3. **Friends List** — from `/api/friends`, list with avatar, username linking to `/profile/:username`, and Unfriend button

All mutations invalidate relevant query keys on success.

---

## 2. Profile: Recent Reviews

### Backend
New endpoint in `server/src/routes/users.ts`:
```
GET /api/users/:username/reviews
→ last 10 reviews (album + track type), orderBy createdAt desc
Include: user, albumCache, _count (likes, comments)
```

### Frontend
`Profile.tsx` — replace placeholder paragraph with:
- `useQuery` fetching `usersApi.getReviews(username)`
- Renders `ReviewCard` components (existing component, `showAlbum` prop)
- Empty state: "No reviews yet" text

Add `getReviews(username)` to `client/src/api/users.ts`.

---

## 3. Feed: Friends-Based

### Backend change — `server/src/routes/users.ts` `/:id/feed`
Replace follow-based query with friendship-based:
```ts
const friendships = await prisma.friendship.findMany({
  where: {
    status: 'accepted',
    OR: [{ requesterId: req.user!.id }, { addresseeId: req.user!.id }],
  },
  select: { requesterId: true, addresseeId: true },
});
const friendIds = friendships.map(f =>
  f.requesterId === req.user!.id ? f.addresseeId : f.requesterId
);
// then query reviews where userId: { in: friendIds }
// orderBy: createdAt desc, take: 50
```

### Frontend change — `Home.tsx`
Empty state message updated: "Add friends to see their reviews here" with link to `/friends`.

---

## 4. Track Star Rating Click Fix

### Root cause
`StarRating.tsx` — the amber overlay span (`position: absolute, inset-0`) intercepts pointer events before the click handler spans beneath it in z-order can receive them.

### Fix
Add `pointer-events-none` to the amber overlay span only:
```tsx
<span
  className="absolute inset-0 overflow-hidden text-vinyl-amber pointer-events-none"
  style={{ width: half ? '50%' : '100%' }}
>
```
Click handler spans (rendered after in DOM) already have correct `cursor-pointer` and event handlers — they just needed the overlay out of the way.

---

## 5. New Features

### A — Notification Badge on Friends Nav Tab
- `Navbar.tsx`: fetch `/api/friends/requests` when user is logged in
- Show count badge (red dot with number) on Friends tab if count > 0
- Invalidated when user visits `/friends` page

### B — Profile Stats Section
`Profile.tsx` — new stats row below the header counters:
- Average rating (computed from user's reviews)
- Total reviews count (already in `profile._count.reviews`)
- Friend count (from `/api/friends` length or add `_count.friendships` to profile endpoint)
- Most-reviewed genre (from AlbumCache via join on reviews)

Backend: extend `GET /api/users/:username` to include `avgRating` and `friendCount` in the response (computed fields).

### C — "What Your Friends Are Listening To" Shelf on Discover
`Discover.tsx` — new HorizontalShelf above or below current top albums:
- Title: "Friends' Recent Reviews"
- Backend: new endpoint `GET /api/friends/recent-reviews` → last 15 unique albums reviewed by friends
- Frontend: HorizontalShelf with those albums (same shape as trending albums)
- Only shown when user is logged in and has at least one friend

---

## Files Touched

### Server
- `server/src/routes/users.ts` — add search endpoint, reviews endpoint, extend profile endpoint, change feed to friends-based
- `server/src/routes/friends.ts` — add recent-reviews endpoint

### Client
- `client/src/App.tsx` — add `/friends` route
- `client/src/components/Navbar.tsx` — add Friends tab with badge
- `client/src/pages/Friends.tsx` — new page
- `client/src/pages/Home.tsx` — update empty state message
- `client/src/pages/Profile.tsx` — add recent reviews section + stats
- `client/src/pages/Discover.tsx` — add friends shelf
- `client/src/api/users.ts` — add `search`, `getReviews` functions
- `client/src/api/friends.ts` — add `getRecentReviews` function
- `client/src/components/StarRating.tsx` — pointer-events-none fix

### Database
- No schema changes needed — all features use existing models
- Data reset script (run once)
