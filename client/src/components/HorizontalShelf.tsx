import { useState, useRef } from 'react';
import AlbumCard from './AlbumCard';

interface ShelfAlbum {
  spotifyAlbumId: string;
  name: string;
  artist: string;
  coverUrl: string;
  releaseYear?: number;
  avgRating?: number | null;
  reviewCount?: number;
}

interface HorizontalShelfProps {
  albums: ShelfAlbum[];
  title: string;
  subtitle?: string;
  maxItems?: number;
  pageSize?: number;
}

export default function HorizontalShelf({
  albums,
  title,
  subtitle,
  maxItems = 15,
  pageSize = 5,
}: HorizontalShelfProps) {
  const [page, setPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const visible = albums.slice(0, maxItems);
  const totalPages = Math.ceil(visible.length / pageSize);
  const start = page * pageSize;
  const pageAlbums = visible.slice(start, start + pageSize);

  const prev = () => setPage((p) => Math.max(0, p - 1));
  const next = () => setPage((p) => Math.min(totalPages - 1, p + 1));

  if (visible.length === 0) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-black text-vinyl-text">{title}</h2>
          {subtitle && <span className="text-xs text-vinyl-muted">{subtitle}</span>}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              disabled={page === 0}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors
                bg-vinyl-surface/80 border border-vinyl-border text-vinyl-muted
                hover:border-vinyl-amber/60 hover:text-vinyl-text
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-xs text-vinyl-muted w-12 text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={next}
              disabled={page === totalPages - 1}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors
                bg-vinyl-surface/80 border border-vinyl-border text-vinyl-muted
                hover:border-vinyl-amber/60 hover:text-vinyl-text
                disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>

      <div ref={scrollRef} className="grid grid-cols-5 gap-4">
        {pageAlbums.map((album) => (
          <AlbumCard key={album.spotifyAlbumId} album={album} />
        ))}
        {/* Fill empty slots to maintain grid layout */}
        {Array.from({ length: pageSize - pageAlbums.length }).map((_, i) => (
          <div key={`empty-${i}`} className="aspect-square" />
        ))}
      </div>
    </section>
  );
}
