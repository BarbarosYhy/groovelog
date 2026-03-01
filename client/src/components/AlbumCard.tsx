import { Link } from 'react-router-dom';

interface Album {
  spotifyAlbumId: string;
  name: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  avgRating?: number | null;
  reviewCount?: number;
}

export default function AlbumCard({ album }: { album: Album }) {
  return (
    <Link to={`/album/${album.spotifyAlbumId}`} className="group block">
      <div className="relative overflow-hidden rounded-xl aspect-square bg-vinyl-surface">
        <img
          src={album.coverUrl}
          alt={album.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
          <p className="text-white text-xs font-semibold leading-tight line-clamp-2">{album.name}</p>
          <p className="text-white/70 text-xs mt-0.5 line-clamp-1">{album.artist}</p>
          {album.avgRating != null && (
            <div className="mt-1 flex items-center gap-1">
              <span className="text-vinyl-amber text-xs">&#9733;</span>
              <span className="text-white text-xs font-medium">{album.avgRating.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 px-0.5">
        <p className="text-xs font-medium text-vinyl-text leading-tight line-clamp-1 group-hover:text-vinyl-amber transition-colors">{album.name}</p>
        <p className="text-xs text-vinyl-muted mt-0.5 line-clamp-1">{album.artist}</p>
      </div>
    </Link>
  );
}
