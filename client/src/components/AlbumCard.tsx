import { Link } from 'react-router-dom';
import StarRating from './StarRating';

interface Album {
  spotifyAlbumId: string;
  name: string;
  artist: string;
  releaseYear: number;
  coverUrl: string;
  avgRating?: number;
  reviewCount?: number;
}

export default function AlbumCard({ album }: { album: Album }) {
  return (
    <Link
      to={`/album/${album.spotifyAlbumId}`}
      className="group block rounded-xl border border-vinyl-border bg-vinyl-surface hover:border-vinyl-amber/40 transition-all hover:-translate-y-0.5"
    >
      <div className="aspect-square overflow-hidden rounded-t-xl">
        {album.coverUrl ? (
          <img
            src={album.coverUrl}
            alt={album.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-vinyl-card text-4xl">🎵</div>
        )}
      </div>
      <div className="p-3">
        <p className="font-semibold text-vinyl-text truncate">{album.name}</p>
        <p className="text-sm text-vinyl-muted truncate">{album.artist}</p>
        <p className="text-xs text-vinyl-muted">{album.releaseYear}</p>
        {album.avgRating !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <StarRating value={album.avgRating} readonly size="sm" />
            <span className="text-xs text-vinyl-muted">{album.reviewCount} reviews</span>
          </div>
        )}
      </div>
    </Link>
  );
}
