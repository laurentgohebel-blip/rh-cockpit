import { STATUS_META } from "@/core/referentiel";
import { toneFor, TONE_HEX } from "@/lib/audit-ui";

export function ScoreRing({ score, status, size = 96, thickness = 8 }) {
  const r = size / 2 - thickness;
  const circ = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score));
  const off = circ * (1 - pct / 100);
  const tone = toneFor(status, STATUS_META);
  const stroke = TONE_HEX[tone];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Score ${score ?? "indisponible"} sur 100`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(220 13% 91%)" strokeWidth={thickness} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={off}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground" style={{ fontSize: size * 0.28, fontWeight: 600 }}>
        {score ?? "—"}
      </text>
      <text x="50%" y="68%" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: size * 0.12 }}>
        / 100
      </text>
    </svg>
  );
}
