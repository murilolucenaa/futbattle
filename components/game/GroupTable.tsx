"use client";

export interface GroupRow {
  flag: string;   // emoji flag (allowed UI exception)
  name: string;
  pts: number;
  j: number;      // played
  v: number;      // wins
  e: number;      // draws
  d: number;      // losses
  gp: number;     // goals for
  gc: number;     // goals against
  user?: boolean; // user's team — gets the ⭐
}

interface GroupTableProps {
  title: string;     // "GRUPO A"
  rows: GroupRow[];  // already sorted by standing
}

// classification bar: top 2 direct (green), 3rd maybe (gold), 4th out
function qualColor(idx: number): string {
  if (idx < 2) return "var(--accent)";
  if (idx === 2) return "var(--trophy)";
  return "transparent";
}

/** Group standings as a TV graphic: zebra rows, colored qualification bar. */
export default function GroupTable({ title, rows }: GroupTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-white/10 bg-[var(--night-2)]">
      <div className="tv-strip flex items-center justify-between px-3 py-1.5">
        <span className="font-display text-lg uppercase tracking-wider">{title}</span>
        <span className="type-label !text-[9px]">Classificação</span>
      </div>
      <table className="tv-table">
        <thead>
          <tr>
            <th className="text-left" colSpan={2}>Seleção</th>
            <th>P</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th><th>SG</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={r.user ? "bg-[rgba(0,255,135,0.06)]" : undefined}>
              <td className="qual-bar w-7 text-center type-stat font-bold text-white/60" style={{ "--qual": qualColor(i) } as React.CSSProperties}>
                {i + 1}
              </td>
              <td className="font-semibold">
                <span className="mr-1.5">{r.flag}</span>
                {r.name}
                {r.user && <span className="ml-1">⭐</span>}
              </td>
              <td className="type-stat text-center font-display text-base text-[var(--accent)]">{r.pts}</td>
              <td className="type-stat text-center text-white/70">{r.j}</td>
              <td className="type-stat text-center text-white/70">{r.v}</td>
              <td className="type-stat text-center text-white/70">{r.e}</td>
              <td className="type-stat text-center text-white/70">{r.d}</td>
              <td className="type-stat text-center text-white/70">{r.gp}</td>
              <td className="type-stat text-center text-white/70">{r.gc}</td>
              <td className="type-stat text-center font-semibold">{r.gp - r.gc > 0 ? `+${r.gp - r.gc}` : r.gp - r.gc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
