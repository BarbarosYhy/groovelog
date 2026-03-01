import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendsApi } from '../api/friends';
import { usersApi } from '../api/users';
import { useAuth } from '../context/AuthContext';

function Avatar({ username }: { username: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-vinyl-amber/20 flex items-center justify-center text-vinyl-amber text-sm font-bold shrink-0">
      {username[0].toUpperCase()}
    </div>
  );
}

export default function Friends() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const { data: friends = [] } = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsApi.getFriends(),
    enabled: !!me,
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsApi.getRequests(),
    enabled: !!me,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ['user-search', searchQ],
    queryFn: () => usersApi.search(searchQ),
    enabled: searchQ.length >= 2,
  });

  const sendMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.sendRequest(userId),
    onSuccess: (_data, userId) => {
      setSentIds((prev) => new Set(prev).add(userId));
      qc.invalidateQueries({ queryKey: ['user-search', searchQ] });
    },
    onError: (_error, userId) => {
      // If already requested (409), still mark as sent
      setSentIds((prev) => new Set(prev).add(userId));
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (friendshipId: string) => friendsApi.accept(friendshipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      qc.invalidateQueries({ queryKey: ['friends'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.remove(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQ(input.trim());
  };

  return (
    <div className="space-y-10 max-w-xl">
      <h1 className="text-2xl font-bold text-vinyl-text">Friends</h1>

      {/* Search */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-vinyl-text">Find People</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search by username..."
            className="flex-1 rounded-xl border border-vinyl-border bg-vinyl-surface px-4 py-2 text-sm text-vinyl-text placeholder-vinyl-muted focus:outline-none focus:border-vinyl-amber/60 transition-colors"
          />
          <button
            type="submit"
            className="rounded-xl bg-vinyl-amber px-4 py-2 text-sm font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
          >
            Search
          </button>
        </form>

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((u: any) => (
              <div
                key={u.id}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={u.username} />
                <Link
                  to={`/profile/${u.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {u.username}
                </Link>
                <button
                  onClick={() => !sentIds.has(u.id) && sendMutation.mutate(u.id)}
                  disabled={sentIds.has(u.id) || sendMutation.isPending}
                  className={`rounded-xl border px-3 py-1.5 text-xs transition-colors disabled:opacity-60 ${
                    sentIds.has(u.id)
                      ? 'border-vinyl-amber/50 text-vinyl-amber cursor-default'
                      : 'border-vinyl-border text-vinyl-muted hover:border-vinyl-amber/60 hover:text-vinyl-text'
                  }`}
                >
                  {sentIds.has(u.id) ? 'Requested ✓' : 'Add Friend'}
                </button>
              </div>
            ))}
          </div>
        )}

        {searchQ.length >= 2 && searchResults.length === 0 && (
          <p className="text-sm text-vinyl-muted">No users found for "{searchQ}".</p>
        )}
      </section>

      {/* Pending Requests */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-vinyl-text">
            Requests{' '}
            <span className="text-vinyl-amber text-sm">({requests.length})</span>
          </h2>
          <div className="space-y-2">
            {requests.map((r: any) => (
              <div
                key={r.friendshipId}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={r.username} />
                <Link
                  to={`/profile/${r.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {r.username}
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptMutation.mutate(r.friendshipId)}
                    disabled={acceptMutation.isPending}
                    className="rounded-xl bg-vinyl-amber px-3 py-1.5 text-xs font-semibold text-black hover:bg-vinyl-amber-light transition-colors disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => removeMutation.mutate(r.id)}
                    disabled={removeMutation.isPending}
                    className="rounded-xl border border-vinyl-border px-3 py-1.5 text-xs text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Friends List */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-vinyl-text">
          Friends{' '}
          <span className="text-vinyl-muted text-sm">({friends.length})</span>
        </h2>
        {friends.length > 0 ? (
          <div className="space-y-2">
            {friends.map((f: any) => (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-xl border border-vinyl-border/50 bg-vinyl-surface px-4 py-3"
              >
                <Avatar username={f.username} />
                <Link
                  to={`/profile/${f.username}`}
                  className="flex-1 text-sm text-vinyl-text hover:text-vinyl-amber transition-colors"
                >
                  {f.username}
                </Link>
                <button
                  onClick={() => removeMutation.mutate(f.id)}
                  disabled={removeMutation.isPending}
                  className="rounded-xl border border-vinyl-border px-3 py-1.5 text-xs text-vinyl-muted hover:border-red-500 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Unfriend
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-sm text-vinyl-muted">
            No friends yet. Search for users above to get started.
          </div>
        )}
      </section>
    </div>
  );
}
