import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { spotifyApi } from '../api/spotify';

export default function Settings() {
  const { user, login, token } = useAuth();
  const qc = useQueryClient();

  const connectMutation = useMutation({
    mutationFn: () => {
      spotifyApi.connect();
      return Promise.resolve();
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => spotifyApi.disconnect(),
    onSuccess: async () => {
      if (token) await login(token);
      qc.invalidateQueries({ queryKey: ['trending'] });
    },
  });

  if (!user) return null;

  const spotifyConnected = !!user.spotifyId;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      <h1 className="text-2xl font-black text-vinyl-text tracking-tight">Account Settings</h1>

      {/* Profile info */}
      <section className="rounded-2xl border border-vinyl-border bg-vinyl-surface p-6 space-y-4">
        <h2 className="font-semibold text-vinyl-text">Profile</h2>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-vinyl-amber/15 flex items-center justify-center text-vinyl-amber font-black text-xl ring-1 ring-vinyl-amber/20">
            {user.username[0].toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-vinyl-text">{user.username}</p>
            <p className="text-sm text-vinyl-muted">{user.email}</p>
          </div>
        </div>
      </section>

      {/* Spotify */}
      <section className="rounded-2xl border border-vinyl-border bg-vinyl-surface p-6 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DB954' }}>
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
          </svg>
          <h2 className="font-semibold text-vinyl-text">Spotify</h2>
        </div>

        {spotifyConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-[#1DB954]/10 border border-[#1DB954]/20 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-[#1DB954]" />
              <div>
                <p className="text-sm font-medium text-vinyl-text">Connected</p>
                <p className="text-xs text-vinyl-muted font-mono">{user.spotifyId}</p>
              </div>
            </div>
            <p className="text-sm text-vinyl-muted">
              Your Spotify account is linked. We use it to auto-fill listen dates when writing reviews.
            </p>
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {disconnectMutation.isPending ? 'Removing…' : 'Remove Spotify account'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-vinyl-muted">
              Connect your Spotify account to auto-fill your listen dates when writing reviews and see your recent listening history.
            </p>
            <button
              onClick={() => connectMutation.mutate()}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:opacity-90"
              style={{ backgroundColor: '#1DB954' }}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
              Connect Spotify
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
