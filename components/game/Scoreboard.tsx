"use client";

interface TeamRef {
  code: string;        // 3-letter code, e.g. "BRA"
  flag: string;        // emoji flag (allowed UI exception)
  color: string;       // kit primary hex
}

interface ScoreboardProps {
  home: TeamRef;
  away: TeamRef;
  score: [number, number];
  minute: number | string; // 73 or "INT" / "FIM" / "PÊN"
  competition?: string;    // e.g. "COPA 2026 · GRUPO A"
}

/** TV-broadcast score strip: kit slabs, 3-letter codes, giant tabular score. */
export default function Scoreboard({ home, away, score, minute, competition }: ScoreboardProps) {
  return (
    <div className="tv-strip flex items-stretch overflow-hidden select-none">
      {/* minute block */}
      <div className="tv-slab flex flex-col items-center justify-center bg-black/50 px-3 py-1">
        <span className="font-display type-stat text-xl leading-none text-[var(--accent)]">
          {typeof minute === "number" ? `${minute}'` : minute}
        </span>
        {competition && <span className="type-label !text-[8px] mt-0.5 whitespace-nowrap">{competition}</span>}
      </div>

      {/* home */}
      <div className="flex flex-1 items-center justify-end gap-2 px-3">
        <span className="text-xl leading-none">{home.flag}</span>
        <span className="font-display text-xl tracking-wider">{home.code}</span>
        <span className="tv-slab h-6 w-2.5" style={{ background: home.color }} />
      </div>

      {/* score */}
      <div className="flex items-center gap-2 bg-black/60 px-4" style={{ boxShadow: "inset 0 0 18px rgba(0,0,0,0.6)" }}>
        <span className="font-display type-stat text-4xl leading-none">{score[0]}</span>
        <span className="font-display text-2xl leading-none text-white/30">–</span>
        <span className="font-display type-stat text-4xl leading-none">{score[1]}</span>
      </div>

      {/* away */}
      <div className="flex flex-1 items-center justify-start gap-2 px-3">
        <span className="tv-slab-rev h-6 w-2.5" style={{ background: away.color }} />
        <span className="font-display text-xl tracking-wider">{away.code}</span>
        <span className="text-xl leading-none">{away.flag}</span>
      </div>
    </div>
  );
}
