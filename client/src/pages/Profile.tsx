import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';
import { useState } from 'react';

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [following, setFollowing] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => usersApi.getProfile(username!),
  });

  const followMutation = useMutation({
    mutationFn: () => usersApi.toggleFollow(profile!.id),
    onSuccess: (data: { following: boolean }) => {
      setFollowing(data.following);
      qc.invalidateQueries({ queryKey: ['profile', username] });
    },
  });

  if (!profile) return <div className="animate-pulse h-32 rounded-xl bg-vinyl-surface" />;

  const isMe = me?.username === username;

  return (
    <div className="space-y-8">
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
        </div>
        {!isMe && me && (
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
        )}
      </div>

      <div>
        <h2 className="text-xl font-bold text-vinyl-text mb-4">Recent Reviews</h2>
        <p className="text-vinyl-muted text-sm">Reviews will appear here.</p>
      </div>
    </div>
  );
}
