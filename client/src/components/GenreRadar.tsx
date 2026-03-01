interface Genre {
  name: string;
  percentage: number;
}

interface Props {
  genres: Genre[];
}

export default function GenreRadar({ genres }: Props) {
  if (genres.length === 0) return null;

  const max = genres[0].percentage;

  return (
    <div className="space-y-3">
      {genres.map((g, i) => (
        <div key={g.name}>
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm text-vinyl-text font-medium capitalize">{g.name}</span>
            <span className="text-sm font-bold text-vinyl-amber tabular-nums">{g.percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-vinyl-border/40 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(g.percentage / max) * 100}%`,
                background: `linear-gradient(to right, #8b5cf6, #f59e0b)`,
                opacity: 1 - i * 0.12,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
