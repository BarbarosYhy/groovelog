interface Genre {
  name: string;
  percentage: number;
}

interface Props {
  genres: Genre[];
}

const SIZE = 200;
const CX = 100;
const CY = 105;
const MAX_R = 72;
const LABEL_R = 90;
const N = 5;

function angle(i: number) {
  return ((2 * Math.PI * i) / N) - Math.PI / 2;
}

function axisPoint(i: number, fraction: number) {
  const a = angle(i);
  return { x: CX + MAX_R * fraction * Math.cos(a), y: CY + MAX_R * fraction * Math.sin(a) };
}

function polygonPoints(fractions: number[]) {
  return fractions
    .map((f, i) => { const p = axisPoint(i, f); return `${p.x.toFixed(2)},${p.y.toFixed(2)}`; })
    .join(' ');
}

function gridLevel(fraction: number) {
  return polygonPoints(Array(N).fill(fraction));
}

export default function GenreRadar({ genres }: Props) {
  if (genres.length === 0) return null;

  const padded = [...genres];
  while (padded.length < N) padded.push({ name: '', percentage: 0 });

  const dataPoints = polygonPoints(padded.map((g) => g.percentage / 100));

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE + 10}`}
        width="100%"
        style={{ maxWidth: 260 }}
        className="overflow-visible"
      >
        {/* Grid rings at 25 / 50 / 75 / 100% */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={gridLevel(f)}
            fill="none"
            stroke="#333333"
            strokeWidth={f === 1 ? 1 : 0.6}
            strokeDasharray={f === 1 ? 'none' : '3 2'}
          />
        ))}

        {/* Axis spokes */}
        {Array.from({ length: N }).map((_, i) => {
          const end = axisPoint(i, 1);
          return (
            <line
              key={i}
              x1={CX} y1={CY}
              x2={end.x.toFixed(2)} y2={end.y.toFixed(2)}
              stroke="#333333"
              strokeWidth={0.6}
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={dataPoints}
          fill="rgba(245,158,11,0.22)"
          stroke="#f59e0b"
          strokeWidth={1.8}
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(245,158,11,0.45))' }}
        />

        {/* Vertex dots */}
        {padded.map((g, i) => {
          if (!g.name) return null;
          const p = axisPoint(i, g.percentage / 100);
          return <circle key={i} cx={p.x.toFixed(2)} cy={p.y.toFixed(2)} r={3} fill="#f59e0b" />;
        })}

        {/* Axis labels */}
        {padded.map((g, i) => {
          if (!g.name) return null;
          const a = angle(i);
          const lx = CX + LABEL_R * Math.cos(a);
          const ly = CY + LABEL_R * Math.sin(a);
          const anchor = lx < CX - 4 ? 'end' : lx > CX + 4 ? 'start' : 'middle';
          return (
            <text
              key={i}
              x={lx.toFixed(2)}
              y={ly.toFixed(2)}
              textAnchor={anchor}
              dominantBaseline="middle"
              fontSize={8.5}
              fill="#e5e7eb"
              fontFamily="inherit"
            >
              {g.name.length > 14 ? g.name.slice(0, 13) + '…' : g.name}
            </text>
          );
        })}

        {/* Percentage labels at each vertex */}
        {padded.map((g, i) => {
          if (!g.name || g.percentage === 0) return null;
          const p = axisPoint(i, g.percentage / 100);
          const a = angle(i);
          const ox = Math.cos(a) * 9;
          const oy = Math.sin(a) * 9;
          return (
            <text
              key={`pct-${i}`}
              x={(p.x + ox).toFixed(2)}
              y={(p.y + oy).toFixed(2)}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill="#f59e0b"
              fontFamily="inherit"
              fontWeight="bold"
            >
              {g.percentage}%
            </text>
          );
        })}
      </svg>
    </div>
  );
}
