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

// fliperama palette
const INK = "#141512";
const PAPER = "#FFFDF5";
const GOLD = "#FFC81B";
const LIMA = "#9ACD1E";
const CIANO = "#4DA3FF";
const LARANJA = "#F25C1F";
const ANTON = "var(--font-anton), sans-serif";

function sectorColor(pos: string): string {
  if (pos === "GK") return GOLD;
  if (pos === "RB" || pos === "CB" || pos === "LB") return CIANO;
  if (pos === "DM" || pos === "CM" || pos === "AM") return LIMA;
  return LARANJA;
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "9px 22px",
        background: PAPER,
        color: INK,
        borderRadius: 999,
        border: `4px solid ${INK}`,
        fontSize: 27,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: 1,
        boxShadow: `3px 4px 0 ${INK}`,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
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
 * a dedicated, story-native layout captured with html-to-image. Built as a flex
 * column so the four bands (brand · hero · pitch · stats) fill the 9:16 frame
 * with no dead gaps. Inline styles only (the rasterizer has no Tailwind); the
 * single document dependency is the Anton/Archivo web fonts the app already loads.
 */
const ShareCard = forwardRef<HTMLDivElement, { data: ShareCardData }>(function ShareCard(
  { data },
  ref,
) {
  const { squadName, coachName, formation, mentality, slots, lineup, teamOvr, meters } = data;
  const hasGoat = lineup.some((c, i) => c && effectiveOvr(c, slots[i].pos) >= 88);

  const name = (squadName || "").trim() || "Minha Seleção";
  // auto-fit the hero name so long names never get hard-cut
  const nameSize = name.length > 20 ? 66 : name.length > 15 ? 84 : name.length > 10 ? 104 : 122;

  const stats: [string, number | string, string][] = [
    ["FORÇA", teamOvr, GOLD],
    ...meters.map(
      ([l, v]) =>
        [l, v ?? "—", l === "ATA" ? LARANJA : l === "MEI" ? LIMA : CIANO] as [string, number | string, string],
    ),
  ];

  return (
    <div
      ref={ref}
      style={{
        width: 1080,
        height: 1920,
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        border: `16px solid ${INK}`,
        background: "#0C3420",
        color: PAPER,
        fontFamily: "var(--font-archivo), sans-serif",
      }}
    >
      {/* ── layered stadium backdrop ─────────────────────────── */}
      <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(0deg,#103f23 0 120px,#0c3420 120px 240px)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1300px 760px at 50% 4%, rgba(255,200,27,0.18), transparent 62%)" }} />
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(1100px 900px at 50% 118%, rgba(0,0,0,0.55), transparent 60%)" }} />
      <div style={{ position: "absolute", inset: 0, opacity: 0.1, backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "28px 28px" }} />

      {/* ── content (flex column fills the frame) ────────────── */}
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>
        {/* BRAND */}
        <div style={{ padding: "50px 64px 0", textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: ANTON,
              fontSize: 58,
              lineHeight: 1,
              letterSpacing: 3,
              textShadow: "3px 4px 0 " + INK,
            }}
          >
            <span style={{ color: GOLD }}>FUT</span>
            <span style={{ color: PAPER }}>BATTLE</span>
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "6px 24px",
              background: LIMA,
              color: INK,
              border: `4px solid ${INK}`,
              borderRadius: 999,
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: 6,
              textTransform: "uppercase",
              boxShadow: `3px 4px 0 ${INK}`,
            }}
          >
            ★ Escalação Oficial
          </div>
        </div>

        {/* HERO — team name + subline */}
        <div style={{ padding: "30px 56px 4px", textAlign: "center", flexShrink: 0 }}>
          <div
            style={{
              fontFamily: ANTON,
              fontSize: nameSize,
              lineHeight: 0.92,
              textTransform: "uppercase",
              textShadow: `5px 6px 0 ${INK}`,
              wordBreak: "break-word",
            }}
          >
            {name}
          </div>
          <div style={{ marginTop: 22, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Pill>{formation}</Pill>
            <Pill>{MENTALITY_LABEL[mentality]}</Pill>
            <Pill>Téc. {coachName}</Pill>
          </div>
        </div>

        {/* PITCH — flex:1 so it absorbs the remaining height, centered */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "30px 0 26px" }}>
          <div
            style={{
              position: "relative",
              width: 904,
              height: "100%",
              borderRadius: 30,
              border: `6px solid ${PAPER}`,
              background:
                "repeating-linear-gradient(0deg, rgba(255,255,255,0.07) 0 90px, rgba(255,255,255,0) 90px 180px), #15823f",
              boxShadow: `0 0 0 6px ${INK}, 8px 10px 0 rgba(0,0,0,0.35)`,
            }}
          >
            {/* halfway line + centre circle */}
            <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 4, background: "rgba(255,255,255,0.3)" }} />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 210,
                height: 210,
                marginLeft: -105,
                marginTop: -105,
                borderRadius: "50%",
                border: "4px solid rgba(255,255,255,0.3)",
              }}
            />
            {/* penalty boxes */}
            <div style={{ position: "absolute", left: "50%", top: 0, width: 320, height: 120, marginLeft: -160, borderLeft: "4px solid rgba(255,255,255,0.22)", borderRight: "4px solid rgba(255,255,255,0.22)", borderBottom: "4px solid rgba(255,255,255,0.22)" }} />
            <div style={{ position: "absolute", left: "50%", bottom: 0, width: 320, height: 120, marginLeft: -160, borderLeft: "4px solid rgba(255,255,255,0.22)", borderRight: "4px solid rgba(255,255,255,0.22)", borderTop: "4px solid rgba(255,255,255,0.22)" }} />

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
                    width: 168,
                  }}
                >
                  {goat && (
                    <div style={{ fontSize: 36, lineHeight: 0.7, color: GOLD, textShadow: `2px 2px 0 ${INK}` }}>★</div>
                  )}
                  <div
                    style={{
                      position: "relative",
                      width: 98,
                      height: 98,
                      borderRadius: "50%",
                      background: color,
                      border: goat ? `6px solid ${GOLD}` : `5px solid ${INK}`,
                      boxShadow: goat ? `0 0 0 6px rgba(255,200,27,0.5), 4px 5px 0 ${INK}` : `4px 5px 0 ${INK}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontFamily: ANTON,
                      fontSize: 48,
                      color: INK,
                    }}
                  >
                    {eff ?? "—"}
                    {card?.flag && (
                      <span
                        style={{
                          position: "absolute",
                          top: -12,
                          right: -10,
                          fontSize: 38,
                          lineHeight: 1,
                          filter: `drop-shadow(0 2px 0 ${INK})`,
                        }}
                      >
                        {card.flag}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      marginTop: 9,
                      maxWidth: 168,
                      padding: "5px 14px",
                      background: INK,
                      color: PAPER,
                      borderRadius: 999,
                      fontSize: 25,
                      fontWeight: 900,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
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
        </div>

        {/* STATS band */}
        <div style={{ flexShrink: 0, background: INK, padding: "26px 56px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            {stats.map(([label, val, col], idx) => (
              <div key={label} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontFamily: ANTON, fontSize: idx === 0 ? 100 : 76, lineHeight: 1, color: col }}>{val}</div>
                <div style={{ fontSize: 25, fontWeight: 900, letterSpacing: 4, color: "#FFFDF5aa", textTransform: "uppercase" }}>{label}</div>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: "3px solid rgba(255,255,255,0.14)",
              textAlign: "center",
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: 5,
              textTransform: "uppercase",
              color: GOLD,
            }}
          >
            ★ Monte a sua seleção · FUTBATTLE
          </div>
        </div>
      </div>

      {/* GOAT corner stamp */}
      {hasGoat && (
        <div
          style={{
            position: "absolute",
            top: 150,
            right: -8,
            transform: "rotate(7deg)",
            background: GOLD,
            color: INK,
            border: `5px solid ${INK}`,
            borderRadius: 16,
            padding: "12px 22px",
            fontFamily: ANTON,
            fontSize: 36,
            letterSpacing: 1,
            boxShadow: `5px 6px 0 ${INK}`,
            zIndex: 2,
          }}
        >
          ★ LENDA EM CAMPO
        </div>
      )}
    </div>
  );
});

export default ShareCard;
