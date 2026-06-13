"use client";

import { forwardRef } from "react";
import type { Position } from "@/lib/game/types";
import { POSITION_SHORT } from "@/lib/game/types";

// fliperama palette (same tokens as ShareCard)
const INK = "#141512";
const PAPER = "#FFFDF5";
const GOLD = "#FFC81B";
const LIMA = "#9ACD1E";
const CIANO = "#4DA3FF";
const LARANJA = "#F25C1F";
const ANTON = "var(--font-anton), sans-serif";

function sectorColor(pos: Position): string {
  if (pos === "GK") return GOLD;
  if (pos === "RB" || pos === "CB" || pos === "LB") return CIANO;
  if (pos === "DM" || pos === "CM" || pos === "AM") return LIMA;
  return LARANJA;
}

export interface ChampionHero {
  name: string;
  pos: Position;
  ovr: number;
  flag?: string;
  badge?: "artilheiro" | "craque";
}

export interface ChampionData {
  coachName: string;
  teamName: string;
  host: string;
  year: number;
  hostFlag: string;
  finalStadium?: string;
  xi: ChampionHero[];
  topScorer?: { name: string; goals: number };
  topRated?: { name: string; rating: number };
  totalGoals: number;
  path: { round: string; opp: string; oppFlag: string; score: string; pens?: string }[];
}

/** Inline trophy (no icon component — the rasterizer only sees this DOM). */
function Trophy({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4h12v3a6 6 0 0 1-12 0V4Z M6 5H3v2a3 3 0 0 0 3 3 M18 5h3v2a3 3 0 0 1-3 3 M12 13v4 M8 21h8 M9 21c0-2 1-4 3-4s3 2 3 4"
        stroke={INK} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        fill="none"
      />
      <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" fill={GOLD} stroke={INK} strokeWidth={1.6} />
      <path d="M12 13c-1.4 0-2.5 1.4-2.7 4h5.4c-.2-2.6-1.3-4-2.7-4Z" fill={GOLD} stroke={INK} strokeWidth={1.4} />
      <rect x="8" y="20" width="8" height="2" rx="1" fill={GOLD} stroke={INK} strokeWidth={1.4} />
    </svg>
  );
}

/**
 * Off-screen 1080×1920 champion story card. Captured with html-to-image like
 * ShareCard. Inline styles only (no Tailwind in the rasterizer).
 */
const ChampionCard = forwardRef<HTMLDivElement, { data: ChampionData }>(function ChampionCard(
  { data },
  ref,
) {
  const { coachName, teamName, host, year, hostFlag, finalStadium, xi, topScorer, topRated, totalGoals, path } = data;
  const name = (teamName || "").trim() || `Seleção ${coachName}`;
  const nameSize = name.length > 20 ? 70 : name.length > 14 ? 92 : name.length > 9 ? 112 : 128;
  const flags = xi.map((h) => h.flag).filter(Boolean) as string[];

  const stats: [string, string, string, string][] = [
    ["GOLS", String(totalGoals), "no torneio", GOLD],
    topScorer ? ["ARTILHEIRO", `${topScorer.goals}g`, topScorer.name, LARANJA] : ["ARTILHEIRO", "—", "", LARANJA],
    topRated ? ["CRAQUE", topRated.rating.toFixed(1), topRated.name, LIMA] : ["CRAQUE", "—", "", LIMA],
  ];

  return (
    <div
      ref={ref}
      style={{
        width: 1080, height: 1920, position: "relative", overflow: "hidden",
        boxSizing: "border-box", border: `16px solid ${INK}`,
        background: "#0C3420", color: PAPER, fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      {/* layered stadium backdrop */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,#103f23 0 120px,#0c3420 120px 240px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1300px 820px at 50% 6%, rgba(255,200,27,0.30), transparent 60%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1100px 900px at 50% 120%, rgba(0,0,0,0.6), transparent 60%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "28px 28px" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* BRAND */}
        <div style={{ padding: "48px 64px 0", textAlign: "center", flexShrink: 0 }}>
          <div style={{ fontFamily: ANTON, fontSize: 52, lineHeight: 1, letterSpacing: 3, textShadow: `3px 4px 0 ${INK}` }}>
            <span style={{ color: GOLD }}>FUT</span><span style={{ color: PAPER }}>BATTLE</span>
          </div>
          <div style={{
            display: "inline-block", marginTop: 16, padding: "8px 30px", background: GOLD, color: INK,
            border: `4px solid ${INK}`, borderRadius: 999, fontFamily: ANTON, fontSize: 38, letterSpacing: 5,
            textTransform: "uppercase", boxShadow: `3px 4px 0 ${INK}`,
          }}>
            ★ Campeão Mundial ★
          </div>
        </div>

        {/* TROPHY + HERO */}
        <div style={{ padding: "26px 56px 0", textAlign: "center", flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
            <div style={{
              width: 230, height: 230, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,200,27,0.35), transparent 70%)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Trophy size={190} />
            </div>
          </div>
          <div style={{
            fontFamily: ANTON, fontSize: nameSize, lineHeight: 0.9, textTransform: "uppercase",
            textShadow: `5px 6px 0 ${INK}`, wordBreak: "break-word", color: PAPER,
          }}>
            {name}
          </div>
          <div style={{
            display: "inline-block", marginTop: 18, padding: "8px 26px", background: PAPER, color: INK,
            border: `4px solid ${INK}`, borderRadius: 999, fontSize: 30, fontWeight: 900, textTransform: "uppercase",
            letterSpacing: 1, boxShadow: `3px 4px 0 ${INK}`,
          }}>
            Téc. {coachName}
          </div>
          <div style={{ marginTop: 20, fontSize: 34, fontWeight: 900, letterSpacing: 2, color: GOLD, textTransform: "uppercase" }}>
            {hostFlag} {host} {year}
          </div>
          {finalStadium && (
            <div style={{ marginTop: 6, fontSize: 26, fontWeight: 700, color: "#FFFDF5cc" }}>final no {finalStadium}</div>
          )}
        </div>

        {/* FLAG STRIP — legends called up */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: "20px 56px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 5, color: "#FFFDF5aa", textTransform: "uppercase", textAlign: "center", marginBottom: 16 }}>
            As lendas convocadas
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
            {xi.map((h, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "8px 16px",
                background: h.badge ? GOLD : INK, color: h.badge ? INK : PAPER,
                border: `3px solid ${INK}`, borderRadius: 999, boxShadow: `3px 3px 0 ${INK}`,
                fontSize: 27, fontWeight: 900,
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 44, height: 44, borderRadius: "50%", background: sectorColor(h.pos), color: INK,
                  fontFamily: ANTON, fontSize: 26, border: `2px solid ${INK}`,
                }}>{h.ovr}</span>
                {h.flag && <span style={{ fontSize: 28 }}>{h.flag}</span>}
                <span style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>{h.name}</span>
                <span style={{ fontSize: 19, opacity: 0.7, fontWeight: 800 }}>{POSITION_SHORT[h.pos]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* PATH (knockout run) */}
        {path.length > 0 && (
          <div style={{ flexShrink: 0, padding: "0 56px 14px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10 }}>
              {path.slice(-5).map((p, i) => (
                <span key={i} style={{
                  padding: "6px 16px", background: "rgba(255,255,255,0.08)", border: "2px solid rgba(255,255,255,0.2)",
                  borderRadius: 12, fontSize: 22, fontWeight: 800,
                }}>
                  <span style={{ color: GOLD, letterSpacing: 1 }}>{p.round}</span>{" "}
                  {p.oppFlag} {p.score}{p.pens ? ` (${p.pens})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* STATS band */}
        <div style={{ flexShrink: 0, background: INK, padding: "24px 56px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {stats.map(([label, val, sub, col], idx) => (
              <div key={label} style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: ANTON, fontSize: idx === 0 ? 96 : 72, lineHeight: 1, color: col }}>{val}</div>
                <div style={{ fontSize: 23, fontWeight: 900, letterSpacing: 3, color: "#FFFDF5aa", textTransform: "uppercase" }}>{label}</div>
                {sub && <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFDF5cc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: 16, paddingTop: 16, borderTop: "3px solid rgba(255,255,255,0.14)", textAlign: "center",
            fontSize: 26, fontWeight: 900, letterSpacing: 5, textTransform: "uppercase", color: GOLD,
          }}>
            ★ Vença a sua Copa · FUTBATTLE
          </div>
        </div>
      </div>
    </div>
  );
});

export default ChampionCard;
