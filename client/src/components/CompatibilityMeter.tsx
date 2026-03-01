interface Props {
  score: number;
  sharedGenres: string[];
  myTopGenre: string | null;
  theirTopGenre: string | null;
  theirUsername: string;
}

const CX = 100;
const CY = 108;
const R = 72;
const SW = 11;
const START = 225;
const SPAN = 270;

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, spanDeg: number) {
  if (spanDeg <= 0) return '';
  const safeDeg = Math.min(spanDeg, 359.99);
  const endDeg = startDeg + safeDeg;
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = safeDeg > 180 ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

function scoreColor(score: number): string {
  if (score >= 65) return '#f59e0b';
  if (score >= 35) return '#fb923c';
  return '#6b7280';
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Excellent match!';
  if (score >= 55) return 'Good vibes';
  if (score >= 35) return 'Some overlap';
  return 'Different tastes';
}

export default function CompatibilityMeter({ score, sharedGenres, myTopGenre, theirTopGenre, theirUsername }: Props) {
  const fillSpan = (score / 100) * SPAN;
  const color = scoreColor(score);

  return (
    <div className="rounded-2xl border border-vinyl-border/60 bg-vinyl-surface p-5 space-y-2">
      <p className="text-xs text-vinyl-muted text-center tracking-widest uppercase">Taste Match</p>

      <svg viewBox="0 0 200 155" width="100%" style={{ maxWidth: 220, display: 'block', margin: '0 auto' }}>
        {/* Background track */}
        <path
          d={arcPath(CX, CY, R, START, SPAN)}
          fill="none"
          stroke="#333333"
          strokeWidth={SW}
          strokeLinecap="round"
        />

        {/* Score arc */}
        {fillSpan > 0 && (
          <path
            d={arcPath(CX, CY, R, START, fillSpan)}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 5px ${color}88)` }}
          />
        )}

        {/* Score number */}
        <text
          x={CX}
          y={CY - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={34}
          fontWeight="bold"
          fill={color}
          fontFamily="inherit"
        >
          {score}
        </text>
        <text
          x={CX}
          y={CY + 22}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10}
          fill="#6b7280"
          fontFamily="inherit"
        >
          {scoreLabel(score)}
        </text>

        {/* 0 and 100 labels */}
        {(() => {
          const s = polar(CX, CY, R + SW / 2 + 6, START);
          const e = polar(CX, CY, R + SW / 2 + 6, START + SPAN);
          return (
            <>
              <text x={s.x.toFixed(2)} y={s.y.toFixed(2)} textAnchor="end" fontSize={7} fill="#6b7280" fontFamily="inherit">0</text>
              <text x={e.x.toFixed(2)} y={e.y.toFixed(2)} textAnchor="start" fontSize={7} fill="#6b7280" fontFamily="inherit">100</text>
            </>
          );
        })()}
      </svg>

      {sharedGenres.length > 0 && (
        <p className="text-xs text-center text-vinyl-muted">
          You both love{' '}
          <span className="text-vinyl-amber font-medium">
            {sharedGenres.join(', ')}
          </span>
        </p>
      )}

      {(myTopGenre || theirTopGenre) && (
        <div className="flex justify-between text-[10px] text-vinyl-muted pt-1">
          {myTopGenre && <span>You: <span className="text-vinyl-text">{myTopGenre}</span></span>}
          {theirTopGenre && <span>{theirUsername}: <span className="text-vinyl-text">{theirTopGenre}</span></span>}
        </div>
      )}
    </div>
  );
}
