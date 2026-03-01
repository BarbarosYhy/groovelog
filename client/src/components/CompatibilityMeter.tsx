interface Props {
  score: number;
  sharedGenres: string[];
  myTopGenre: string | null;
  theirTopGenre: string | null;
  theirUsername: string;
}

function scoreTier(score: number): { emoji: string; label: string } {
  if (score >= 85) return { emoji: '🎯', label: 'Kindred Spirits' };
  if (score >= 65) return { emoji: '🔥', label: 'Great Vibes' };
  if (score >= 45) return { emoji: '🎵', label: 'Some Overlap' };
  if (score >= 25) return { emoji: '🌊', label: 'Different Worlds' };
  return { emoji: '🌌', label: 'Total Opposites' };
}

function scoreColor(score: number): string {
  if (score >= 65) return '#f59e0b';
  if (score >= 45) return '#fb923c';
  return '#6b7280';
}

export default function CompatibilityMeter({ score, sharedGenres, myTopGenre, theirTopGenre, theirUsername }: Props) {
  const tier = scoreTier(score);
  const color = scoreColor(score);
  const barWidth = score * 2; // 200px = 100%

  return (
    <div className="rounded-2xl border border-vinyl-border/60 bg-vinyl-surface p-5 space-y-3 max-w-sm w-full">
      <p className="text-xs text-vinyl-muted tracking-widest uppercase text-center">Taste Match</p>

      {/* Score + tier */}
      <div className="text-center">
        <div className="text-5xl font-bold" style={{ color }}>{score}%</div>
        <div className="mt-1 text-sm text-vinyl-muted">{tier.emoji} {tier.label}</div>
      </div>

      {/* Gradient progress bar */}
      <div>
        <svg viewBox="0 0 200 14" width="100%" style={{ display: 'block' }}>
          <defs>
            <linearGradient id="bar-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor={color} />
            </linearGradient>
            <filter id="bar-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Track */}
          <rect x={0} y={3} width={200} height={8} rx={4} fill="#333333" />
          {/* Fill */}
          {barWidth > 0 && (
            <rect
              x={0}
              y={3}
              width={barWidth}
              height={8}
              rx={4}
              fill="url(#bar-gradient)"
              filter="url(#bar-glow)"
            />
          )}
        </svg>
        <div className="flex justify-between text-[10px] text-vinyl-muted mt-0.5 px-0.5">
          <span>0</span>
          <span>100</span>
        </div>
      </div>

      {/* Shared genres */}
      {sharedGenres.length > 0 && (
        <div>
          <p className="text-xs text-vinyl-muted mb-1.5">You both vibe to:</p>
          <div className="flex flex-wrap gap-1.5">
            {sharedGenres.map((g) => (
              <span
                key={g}
                className="px-2 py-0.5 rounded-full text-[11px] bg-vinyl-amber/10 text-vinyl-amber border border-vinyl-amber/20"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* You vs Them */}
      {(myTopGenre || theirTopGenre) && (
        <div className="flex justify-between text-[11px] text-vinyl-muted border-t border-vinyl-border/40 pt-2">
          {myTopGenre ? (
            <span>You — <span className="text-vinyl-text">{myTopGenre}</span></span>
          ) : <span />}
          {theirTopGenre ? (
            <span><span className="text-vinyl-text">{theirTopGenre}</span> — {theirUsername}</span>
          ) : <span />}
        </div>
      )}
    </div>
  );
}
