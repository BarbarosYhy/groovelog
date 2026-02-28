import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { playlistsApi } from '../api/playlists';
import ReviewCard from '../components/ReviewCard';
import { useAuth } from '../context/AuthContext';

export default function PlaylistDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const { data: playlist, isLoading } = useQuery({
    queryKey: ['playlist', id],
    queryFn: () => playlistsApi.getById(id!),
  });

  if (isLoading) return <div className="animate-pulse h-64 rounded-xl bg-vinyl-surface" />;
  if (!playlist) return <div className="text-vinyl-muted">Playlist not found</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end">
        {playlist.coverUrl ? (
          <img src={playlist.coverUrl} alt={playlist.title} className="h-48 w-48 rounded-2xl object-cover shadow-2xl shadow-black/60" />
        ) : (
          <div className="h-48 w-48 rounded-2xl bg-vinyl-surface border border-vinyl-border flex items-center justify-center text-5xl">🎶</div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-vinyl-amber uppercase tracking-widest">
            {playlist.type === 'spotify_import' ? 'Spotify Import' : 'Curated Playlist'}
          </p>
          <h1 className="text-3xl font-bold text-vinyl-text">{playlist.title}</h1>
          {playlist.description && <p className="text-vinyl-muted">{playlist.description}</p>}
          <Link to={`/profile/${playlist.user.username}`} className="text-sm text-vinyl-muted hover:text-vinyl-amber transition-colors">
            by {playlist.user.username}
          </Link>
          {user && (
            <div className="pt-2">
              <Link
                to={`/review/new?playlistId=${id}`}
                className="inline-block rounded-xl bg-vinyl-amber px-5 py-2 font-semibold text-black hover:bg-vinyl-amber-light transition-colors"
              >
                Review This Playlist
              </Link>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-vinyl-text mb-4">Albums ({playlist.items.length})</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {playlist.items.map((item: any) => (
            <Link key={item.id} to={`/album/${item.spotifyAlbumId}`} className="group">
              <img src={item.album.coverUrl} alt={item.album.name} className="aspect-square w-full rounded-xl object-cover group-hover:opacity-80 transition-opacity" />
              <p className="mt-1 text-xs text-vinyl-muted truncate">{item.album.name}</p>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-vinyl-text mb-4">Reviews</h2>
        {playlist.reviews.length > 0 ? (
          <div className="space-y-4">{playlist.reviews.map((r: any) => <ReviewCard key={r.id} review={r} />)}</div>
        ) : (
          <div className="rounded-xl border border-dashed border-vinyl-border p-10 text-center text-vinyl-muted">
            No reviews yet for this playlist.
          </div>
        )}
      </div>
    </div>
  );
}
