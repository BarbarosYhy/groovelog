import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users';
import { friendsApi } from '../api/friends';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';
import AlbumCard from '../components/AlbumCard';
import ReviewCard from '../components/ReviewCard';
import GenreRadar from '../components/GenreRadar';
import CompatibilityMeter from '../components/CompatibilityMeter';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!),
  });

  const { data: wantList } = useQuery({
    queryKey: ['want-list', username],
    queryFn: () => usersApi.getWantList(username!),
    enabled: !!username,
  });

  const { data: recentReviews } = useQuery({
    queryKey: ['user-reviews', username],
    queryFn: () => usersApi.getReviews(username!),
    enabled: !!username,
  });

  const isMe = me?.username === username;

  const { data: topGenresData } = useQuery({
    queryKey: ['top-genres', username],
    queryFn: () => usersApi.getTopGenres(username!),
    enabled: !!username,
    staleTime: 10 * 60 * 1000,
  });

  const { data: compatibility } = useQuery({
    queryKey: ['compatibility', username],
    queryFn: () => usersApi.getCompatibility(username!),
    enabled: !!me && !!username && !isMe,
    staleTime: 5 * 60 * 1000,
  });

  const { data: friendStatus, refetch: refetchFriendStatus } = useQuery({
    queryKey: ['friend-status', profile?.id],
    queryFn: () => friendsApi.getStatus(profile!.id),
    enabled: !!me && !!profile && !isMe,
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.toggleFollow(profile!.id),
    onSuccess: (data: { following: boolean }) => {
      setFollowing(data.following);
      qc.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: () => friendsApi.sendRequest(profile!.id),
    onSuccess: () => refetchFriendStatus(),
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) => friendsApi.accept(friendshipId),
    onSuccess: () => refetchFriendStatus(),
  });

  const removeMutation = useMutation({
    mutationFn: () => friendsApi.remove(profile!.id),
    onSuccess: () => refetchFriendStatus(),
  });

  if (!profile) return <div className="animate-pulse h-32 rounded-xl bg-vinyl-surface" />;

  const renderFriendButton = () => {
    if (!me || isMe || !friendStatus) return null;
    const { status, friendshipId } = friendStatus;

    if (status === 'friends') {
      return (
        <button
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          className="rounded-xl border border-vinyl-border px-4 py-2 text-sm text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          Friends ✓
        </button>
      );
    }
    if (status === 'pending_sent') {
      return (
        <button
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending}
          className="rounded-xl border border-vinyl-border px-4 py-2 text-sm text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
        >
          Request Sent
        </button>
      );
    }
    if (status === 'pending_received' && friendshipId) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => acceptMutation.mutate(friendshipId)}
            disabled={acceptMutation.isPending}
            className="rounded-xl bg-vinyl-amber px-4 py-2 text-sm font-semibold text-black hover:bg-vinyl-amber-light transition-colors disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => removeMutation.mutate()}
            disabled={removeMutation.isPending}
            className="rounded-xl border border-vinyl-border px-4 py-2 text-sm text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      );
    }
    // status === 'none'
    return (
      <button
        onClick={() => sendRequestMutation.mutate()}
        disabled={sendRequestMutation.isPending}
        className="rounded-xl bg-vinyl-surface border border-vinyl-border px-4 py-2 text-sm text-vinyl-text hover:border-vinyl-amber/60 transition-colors disabled:opacity-50"
      >
        Add Friend
      </button>
    );
  };

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex items-center gap-6">
        <div className="h-20 w-20 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber text-3xl font-bold">
          {profile.username[0].toUpperCase()}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-vinyl-text">{profile.username}</h1>
          {profile.bio && <p className="text-vinyl-muted mt-1">{profile.bio}</p>}
          <div className="flex gap-4 mt-2 text-sm text-vinyl-muted">
            <span><strong className="text-vinyl-text">{profile._count.reviews}</strong> reviews</span>
            <span><strong className="text-vinyl-text">{profile._count.followers}</strong> followers</span>
            <span><strong className="text-vinyl-text">{profile._count.following}</strong> following</span>
          </div>
          <div className="flex gap-4 mt-1 text-sm text-vinyl-muted">
            {(profile as any).avgRating != null && (
              <span>avg <strong className="text-vinyl-amber">{((profile as any).avgRating as number).toFixed(1)}★</strong></span>
            )}
            <span><strong className="text-vinyl-text">{(profile as any).friendCount ?? 0}</strong> friends</span>
          </div>
        </div>
        {!isMe && me && (
          <div className="flex items-center gap-2">
            {renderFriendButton()}
            <button
              onClick={() => followMutation.mutate()}
              className={`rounded-xl px-5 py-2 font-semibold transition-colors ${
                following
                  ? 'border border-vinyl-border text-vinyl-muted hover:border-red-500 hover:text-red-400'
                  : 'bg-vinyl-amber text-black hover:bg-vinyl-amber-light'
              }`}
            >
              {following ? 'Unfollow' : 'Follow'}
            </button>
          </div>
        )}
      </div>

      {/* Genre Taste Profile */}
      {topGenresData?.connected === true && topGenresData.genres && topGenresData.genres.length > 0 && (
        <div className="rounded-2xl border border-vinyl-border/60 bg-vinyl-surface p-5">
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-base font-bold text-vinyl-text">Genre Profile</h2>
            <span className="text-xs text-vinyl-muted">· last 4 weeks</span>
          </div>
          <GenreRadar genres={topGenresData.genres} />
        </div>
      )}
      {topGenresData?.connected === false && isMe && (
        <div className="rounded-xl border border-dashed border-vinyl-border p-6 text-center text-sm text-vinyl-muted">
          <Link to="/settings" className="text-vinyl-amber hover:underline">Connect Spotify</Link>
          {' '}to see your genre profile
        </div>
      )}

      {/* Compatibility — shown to other logged-in users */}
      {!isMe && me && compatibility && (
        <CompatibilityMeter
          score={compatibility.score}
          sharedGenres={compatibility.sharedGenres}
          myTopGenre={compatibility.myTopGenre}
          theirTopGenre={compatibility.theirTopGenre}
          theirUsername={username!}
        />
      )}

      {/* Want to Listen */}
      {wantList && wantList.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 mb-4">
            <h2 className="text-xl font-bold text-vinyl-text">Want to Listen</h2>
            <span className="text-xs text-vinyl-muted">
              · {wantList.length} album{wantList.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {wantList.map((album) => (
              <AlbumCard
                key={album.spotifyAlbumId}
                album={{
                  spotifyAlbumId: album.spotifyAlbumId,
                  name: album.name,
                  artist: album.artist,
                  coverUrl: album.coverUrl,
                  releaseYear: album.releaseYear,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      <div>
        <h2 className="text-xl font-bold text-vinyl-text mb-4">Recent Reviews</h2>
        {recentReviews && recentReviews.length > 0 ? (
          <div className="space-y-4">
            {recentReviews.map((review: any) => (
              <ReviewCard key={review.id} review={review} showAlbum />
            ))}
          </div>
        ) : (
          <p className="text-vinyl-muted text-sm">No reviews yet.</p>
        )}
      </div>
    </div>
  );
}
