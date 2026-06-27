interface Props {
  score: number;
  size?: number;
  label?: string;
}

function colorFor(score: number): string {
  if (score >= 75) return "#6fae8f"; // good
  if (score >= 55) return "#c9a25f"; // warn
  return "#bd7373"; // bad
}

export default function ScoreGauge({ score, size = 168, label = "Overall score" }: Props) {
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, score));
  const offset = circumference - (clamped / 100) * circumference;
  const color = colorFor(clamped);

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#2a3342"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 1s ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-4xl text-body" style={{ color }}>
            {Math.round(clamped)}
          </span>
          <span className="text-xs text-muted">out of 100</span>
        </div>
      </div>
      <span className="mt-2 text-sm font-medium text-muted">{label}</span>
    </div>
  );
}
