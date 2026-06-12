"use client";

import { forwardRef } from "react";
import type { Card, FormationId, FormationSlot, Mentality } from "@/lib/game/types";
import { POSITION_SHORT } from "@/lib/game/types";
import { effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL } from "@/lib/game/tactics";

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}

function sectorColor(pos: string): string {
  if (pos === "GK") return "#FFC81B";
  if (pos === "RB" || pos === "CB" || pos === "LB") return "#4DA3FF";
  if (pos === "DM" || pos === "CM" || pos === "AM") return "#9ACD1E";
  return "#F25C1F";
}

export interface ShareCardData {
  squadName: string;
  coachName: string;
  formation: FormationId;
  mentality: Mentality;
  slots: FormationSlot[];
  lineup: (Card | null)[];
  teamOvr: number;
  meters: [string, number | null][];
}

/**
 * Off-screen 1080×1920 story card for sharing the lineup. Not a screenshot —
 * a dedicated FUT-companion-style layout captured with html-to-image. Uses
 * inline styles so the rasterizer needs no Tailwind context; the only document
 * dependency is the Anton/Archivo web fonts already loaded by the app.
 */
const ShareCard = forwardRef<HTMLDivElement, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  const { squadName, coachName, formation, mentality, slots, lineup, teamOvr, meters } = data;
  const hasGoat = lineup.some((c, i) => c && effectiveOvr(c, slots[i].pos) >= 88);

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        position: "relative",
        overflow: "hidden",
        background:
          "repeating-linear-gradient(0deg, #0F3D22 0 120px, #0C3420 120px 240px)",
        color: "#FFFDF5",
        fontFamily: "var(--font-archivo), sans-serif",
        border: "14px solid #141512",
        boxSizing: "border-box",
      }}
    >
      {/* top header */}
      <div style={{ padding: "56px 64px 0", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-anton), sans-serif",
            fontSize: 84,
            lineHeight: 1,
            letterSpacing: 2,
            color: "#FFC81B",
            WebkitTextStroke: "4px #141512",
            textShadow: "6px 7px 0 #141512",
          }}
        >
          FUTBATTLE
        </div>
        <div
          style={{
            marginTop: 14,
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#9ACD1E",
          }}
        >
          Escalação oficial
        </div>
      </div>

      {/* squad name */}
      <div style={{ padding: "28px 64px 0", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--font-anton), sans-serif",
            fontSize: 110,
            lineHeight: 0.95,
            textTransform: "uppercase",
            textShadow: "5px 6px 0 #141512",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {squadName}
        </div>
        <div style={{ marginTop: 10, fontSize: 30, fontWeight: 700, color: "#FFFDF5cc" }}>
          {formation} · {MENTALITY_LABEL[mentality]} · Téc. {coachName}
        </div>
      </div>

      {/* pitch with chips */}
      <div
        style={{
          position: "relative",
          margin: "40px auto 0",
          width: 880,
          height: 1040,
          borderRadius: 28,
          border: "6px solid #FFFDF5",
          background:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0 86px, rgba(255,255,255,0) 86px 172px), #15823f",
          boxShadow: "0 0 0 6px #141512",
        }}
      >
        {/* center line + circle */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: "rgba(255,255,255,0.3)" }} />
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 200,
            height: 200,
            marginLeft: -100,
            marginTop: -100,
            borderRadius: "50%",
            border: "4px solid rgba(255,255,255,0.3)",
          }}
        />
        {slots.map((s, i) => {
          const card = lineup[i];
          const eff = card ? effectiveOvr(card, s.pos) : null;
          const color = sectorColor(s.pos);
          const goat = eff !== null && eff >= 88;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${s.y}%`,
                bottom: `${s.x}%`,
                transform: "translate(-50%, 50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 150,
              }}
            >
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: "50%",
                  background: color,
                  border: goat ? "6px solid #FFC81B" : "5px solid #141512",
                  boxShadow: goat ? "0 0 24px rgba(255,200,27,0.8), 4px 5px 0 #141512" : "4px 5px 0 #141512",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-anton), sans-serif",
                  fontSize: 46,
                  color: "#141512",
                }}
              >
                {eff ?? "—"}
              </div>
              <div
                style={{
                  marginTop: 8,
                  maxWidth: 150,
                  padding: "4px 12px",
                  background: "#141512",
                  borderRadius: 999,
                  fontSize: 24,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {card ? shortName(card.player.name) : POSITION_SHORT[s.pos]}
              </div>
            </div>
          );
        })}
      </div>

      {/* bottom stat band */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: "30px 64px 44px",
          background: "#141512",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
        }}
      >
        {([["FORÇA", teamOvr, "#FFC81B"], ...meters.map(([l, v]) => [l, v ?? "—", l === "ATA" ? "#F25C1F" : l === "MEI" ? "#9ACD1E" : "#4DA3FF"] as const)] as const).map(
          ([label, val, col]) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-anton), sans-serif", fontSize: 76, lineHeight: 1, color: col as string }}>
                {val}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 4, color: "#FFFDF5aa" }}>{label}</div>
            </div>
          ),
        )}
      </div>

      {hasGoat && (
        <div
          style={{
            position: "absolute",
            top: 40,
            right: 40,
            transform: "rotate(8deg)",
            background: "#FFC81B",
            color: "#141512",
            border: "5px solid #141512",
            borderRadius: 16,
            padding: "10px 20px",
            fontFamily: "var(--font-anton), sans-serif",
            fontSize: 34,
            boxShadow: "4px 5px 0 #141512",
          }}
        >
          ★ LENDA EM CAMPO
        </div>
      )}
    </div>
  );
});

export default ShareCard;
