import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/users';
import { reviewsApi } from '../api/reviews';
import { spotifyApi } from '../api/spotify';
import ReviewCard from '../components/ReviewCard';
import HorizontalShelf from '../components/HorizontalShelf';
import { Link } from 'react-router-dom';

type FeedMode = 'friends' | 'community';
type CommunitySort = 'new' | 'hot';

export default function Home() {
  const { user } = useAuth();
  const spotifyConnected = !!user?.spotifyId;
  const [feedMode, setFeedMode] = useState<FeedMode>('friends');
  const [communitySort, setCommunitySort] = useState<CommunitySort>('new');

  const { data: feed, isLoading: feedLoading } = useQuery({
    queryKey: ['feed', user?.id],
    queryFn: () => usersApi.getFeed(user!.id),
    enabled: !!user && feedMode === 'friends',
  });

  const { data: communityReviews, isLoading: communityLoading } = useQuery({
    queryKey: ['community', communitySort],
    queryFn: () => reviewsApi.getCommunity(communitySort),
    enabled: feedMode === 'community',
    staleTime: 2 * 60 * 1000,
  });

  const { data: recentlyPlayed } = useQuery({
    queryKey: ['recently-played'],
    queryFn: () => spotifyApi.getRecentlyPlayed(),
    enabled: spotifyConnected,
    staleTime: 5 * 60 * 1000,
  });

  const recentAlbums = (recentlyPlayed ?? []).slice(0, 15).map((r) => ({
    spotifyAlbumId: r.albumId,
    name: r.albumName,
    artist: r.artist,
    coverUrl: r.coverUrl,
    releaseYear: 0,
    genres: [],
  }));

  const isLoading = feedMode === 'friends' ? feedLoading : communityLoading;

  return (
    <div className="space-y-6">
      {/* Your Recent Plays — only shown when Spotify is connected */}
      {spotifyConnected && recentAlbums.length > 0 && (
        <HorizontalShelf
          albums={recentAlbums}
          title="Your Recent Plays"
          subtitle="· From your Spotify"
        />
      )}

      {/* Feed toggle: Friends | Community */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
          {(['friends', 'community'] as FeedMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setFeedMode(mode)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors capitalize ${
                feedMode === mode
                  ? 'bg-vinyl-amber text-black'
                  : 'text-vinyl-muted hover:text-vinyl-text'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* New/Hot sub-toggle — only visible in Community mode */}
        {feedMode === 'community' && (
          <div className="flex gap-1 rounded-xl bg-vinyl-surface border border-vinyl-border p-1">
            {(['new', 'hot'] as CommunitySort[]).map((s) => (
              <button
                key={s}
                onClick={() => setCommunitySort(s)}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                  communitySort === s
                    ? 'bg-vinyl-amber text-black'
                    : 'text-vinyl-muted hover:text-vinyl-text'
                }`}
              >
                {s === 'hot' ? '🔥 Hot' : '✨ New'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feed content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-vinyl-surface" />
          ))}
        </div>
      ) : feedMode === 'friends' ? (
        feed && feed.length > 0 ? (
          <div className="space-y-4">
            {feed.map((review: any) => (
              <ReviewCard key={review.id} review={review} showAlbum />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center space-y-3">
            <span className="text-5xl block">🎵</span>
            <p className="text-vinyl-text font-medium">Your feed is empty</p>
            <p className="text-vinyl-muted text-sm">Add friends to see their reviews here.</p>
            <Link
              to="/friends"
              className="inline-block mt-2 rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
            >
              Find Friends
            </Link>
          </div>
        )
      ) : (
        communityReviews && communityReviews.length > 0 ? (
          <div className="space-y-4">
            {communityReviews.slice(0, 20).map((review: any) => (
              <ReviewCard key={review.id} review={review} showAlbum />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-16 text-center text-sm text-vinyl-muted">
            No reviews yet.
          </div>
        )
      )}
    </div>
  );
}
