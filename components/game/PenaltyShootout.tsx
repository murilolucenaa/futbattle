"use client";

// ============================================================
// Animated penalty shootout — "2000s Flash penalty game" energy,
// modern + fluid (framer-motion). Pure replay of the engine's
// recorded kick sequence (deterministic): the engine decides who
// scores, this scene only choreographs HOW (corner, keeper dive,
// save vs. miss) from a per-kick seed.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { mulberry32 } from "@/lib/game/engine";
import { sound, vibrate } from "@/src/audio/SoundManager";
import type { MatchTeam, PenaltyShootout as Shootout } from "@/lib/game/types";

// ── scene geometry (% of the scene box) ──────────────────────
const COLX = [27, 50, 73];           // left / center / right inside the goal
const ROW = { low: 43, high: 19 };   // bottom-corner / top-corner heights
const SPOT = { x: 50, y: 85 };       // penalty spot
const KEEPER_REST = { x: 50, y: 37 };

type Phase = "announce" | "kick" | "result" | "done";
type Outcome = "goal" | "save" | "miss";
interface Visual {
  outcome: Outcome;
  ball: { x: number; y: number };
  keeper: { x: number; y: number; rot: number };
}

/** Choreograph one kick from a seed; the scored/missed truth comes from `scored`. */
function kickVisual(scored: boolean, seedN: number): Visual {
  const r = mulberry32(seedN >>> 0);
  const col = Math.floor(r() * 3);
  const high = r() < 0.42;
  const y = high ? ROW.high : ROW.low;
  const keeperY = high ? 23 : 41;

  if (scored) {
    // keeper usually guesses the wrong side → ball nestles in the corner
    const wrong = (col + 1 + (r() < 0.5 ? 0 : 1)) % 3;
    const kCol = r() < 0.78 ? wrong : col;
    return {
      outcome: "goal",
      ball: { x: COLX[col], y },
      keeper: { x: COLX[kCol], y: r() < 0.5 ? 23 : 41, rot: (kCol - 1) * 62 },
    };
  }
  if (r() < 0.6) {
    // SAVE — keeper reads it, ball dies in the gloves
    return {
      outcome: "save",
      ball: { x: COLX[col], y: keeperY },
      keeper: { x: COLX[col], y: keeperY, rot: (col - 1) * 62 },
    };
  }
  // MISS — ball flies wide or over; keeper commits the wrong way
  const wide = r() < 0.55;
  const kCol = Math.floor(r() * 3);
  return {
    outcome: "miss",
    ball: wide ? { x: col === 2 ? 95 : col === 0 ? 5 : (r() < 0.5 ? 5 : 95), y } : { x: COLX[col], y: 5 },
    keeper: { x: COLX[kCol], y: r() < 0.5 ? 23 : 41, rot: (kCol - 1) * 62 },
  };
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Stylised keeper figure (defending kit colour). */
function Keeper({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 44 58" width="100%" height="100%" style={{ filter: "drop-shadow(2px 3px 0 rgba(20,21,18,0.5))" }}>
      <ellipse cx="22" cy="55" rx="13" ry="3" fill="rgba(0,0,0,0.3)" />
      {/* legs */}
      <rect x="15" y="36" width="5.5" height="17" rx="2.5" fill="#141512" />
      <rect x="23.5" y="36" width="5.5" height="17" rx="2.5" fill="#141512" />
      {/* arms + gloves (raised, ready) */}
      <rect x="2" y="12" width="11" height="6.5" rx="3.2" fill={color} stroke="#141512" strokeWidth="2" transform="rotate(-32 13 16)" />
      <rect x="31" y="12" width="11" height="6.5" rx="3.2" fill={color} stroke="#141512" strokeWidth="2" transform="rotate(32 31 16)" />
      <circle cx="4.5" cy="8" r="4" fill="#F4F7F5" stroke="#141512" strokeWidth="2" />
      <circle cx="39.5" cy="8" r="4" fill="#F4F7F5" stroke="#141512" strokeWidth="2" />
      {/* body + head */}
      <rect x="12" y="15" width="20" height="23" rx="6" fill={color} stroke="#141512" strokeWidth="2.4" />
      <circle cx="22" cy="9.5" r="6.2" fill="#F1C9A5" stroke="#141512" strokeWidth="2.4" />
    </svg>
  );
}

/** Flat stitched ball. */
function Ball() {
  return (
    <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ filter: "drop-shadow(1px 2px 0 rgba(20,21,18,0.5))" }}>
      <circle cx="12" cy="12" r="11" fill="#FFFDF5" stroke="#141512" strokeWidth="2" />
      <polygon points="12,6 16,9 14.5,14 9.5,14 8,9" fill="#141512" />
      <path d="M12 1.5 L12 6 M22 9 L16 9 M19 20 L14.5 14 M5 20 L9.5 14 M2 9 L8 9" stroke="#141512" strokeWidth="1.4" fill="none" />
    </svg>
  );
}

export default function PenaltyShootout({
  shootout, home, away, userSide, seed, onDone,
}: {
  shootout: Shootout;
  home: MatchTeam;
  away: MatchTeam;
  userSide: "h" | "a";
  seed: number;
  onDone: () => void;
}) {
  const kicks = shootout.kicks;
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("announce");

  useEffect(() => { if (kicks.length === 0) onDone(); }, [kicks.length, onDone]);

  const visuals = useMemo(
    () => kicks.map((k, i) => kickVisual(k.scored, seed * 2654435761 + i * 40503 + 7)),
    [kicks, seed],
  );

  // state machine: announce → kick → result → next (self-clearing per step)
  useEffect(() => {
    if (idx >= kicks.length) { setPhase("done"); return; }
    let t: ReturnType<typeof setTimeout>;
    if (phase === "announce") {
      sound.play("ui.tick");
      t = setTimeout(() => setPhase("kick"), 950);
    } else if (phase === "kick") {
      t = setTimeout(() => setPhase("result"), 560);
    } else {
      const v = visuals[idx];
      if (v.outcome === "goal") { sound.play("goal.horn"); vibrate(28); }
      else { sound.play("crowd.ooh"); vibrate(12); }
      t = setTimeout(() => { setIdx((i) => i + 1); setPhase("announce"); }, 1350);
    }
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase, kicks.length]);

  const decided = phase === "done";
  useEffect(() => {
    if (decided) sound.play("whistle.end");
  }, [decided]);

  const skip = () => { setIdx(kicks.length); setPhase("done"); };

  // revealed-through-now bookkeeping
  const shown = decided ? kicks.length : idx + (phase === "result" ? 1 : 0);
  const tag = (side: "h" | "a") =>
    kicks.map((k, i) => ({ ...k, gi: i })).filter((k) => k.side === side);
  const hKicks = tag("h"), aKicks = tag("a");
  const scoredH = hKicks.filter((k) => k.gi < shown && k.scored).length;
  const scoredA = aKicks.filter((k) => k.gi < shown && k.scored).length;

  const cur = idx < kicks.length ? kicks[idx] : null;
  const v = idx < kicks.length ? visuals[idx] : null;
  const shooterSide = cur?.side ?? "h";
  const shootingTeam = shooterSide === "h" ? home : away;
  const defendingTeam = shooterSide === "h" ? away : home;
  const shootColor = shooterSide === userSide ? "var(--lima)" : "var(--rosa)";
  const orderInSide = cur
    ? (shooterSide === "h" ? hKicks : aKicks).findIndex((k) => k.gi === idx) + 1
    : 0;
  const suddenDeath = orderInSide > 5;

  const winnerSide: "h" | "a" = shootout.h > shootout.a ? "h" : "a";
  const winnerTeam = winnerSide === "h" ? home : away;
  const userWon = winnerSide === userSide;

  const showResult = phase === "result" || decided;
  const ballTarget = v && (phase === "kick" || phase === "result")
    ? { left: `${v.ball.x}%`, top: `${v.ball.y}%`, scale: 0.5 }
    : { left: `${SPOT.x}%`, top: `${SPOT.y}%`, scale: 1 };
  const keeperTarget = v && (phase === "kick" || phase === "result")
    ? { left: `${v.keeper.x}%`, top: `${v.keeper.y}%`, rotate: v.keeper.rot }
    : { left: `${KEEPER_REST.x}%`, top: `${KEEPER_REST.y}%`, rotate: 0 };

  const Dot = ({ s }: { s: "goal" | "miss" | "pending" | "empty" }) => (
    <span
      className="inline-block h-3.5 w-3.5 rounded-full border-2 border-[var(--ink)]"
      style={{
        background: s === "goal" ? "var(--lima)" : s === "miss" ? "#C0182B" : s === "pending" ? "rgba(255,253,245,0.18)" : "transparent",
        borderColor: s === "empty" ? "rgba(255,253,245,0.25)" : "var(--ink)",
        opacity: s === "empty" ? 0.4 : 1,
      }}
    />
  );
  const dotsFor = (sideKicks: ReturnType<typeof tag>) => {
    const n = Math.max(5, sideKicks.length);
    return Array.from({ length: n }, (_, j) => {
      const k = sideKicks[j];
      if (!k) return "empty" as const;
      if (k.gi < shown) return k.scored ? ("goal" as const) : ("miss" as const);
      return "pending" as const;
    });
  };

  const TeamHead = ({ team, side, score, align }: { team: MatchTeam; side: "h" | "a"; score: number; align: "left" | "right" }) => (
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse text-right" : ""}`}>
      <span className="shrink-0 text-2xl sm:text-3xl">{team.flag}</span>
      <div className="min-w-0">
        <div className={`truncate font-arc text-[11px] font-extrabold uppercase tracking-tight ${side === userSide ? "text-[var(--lima)]" : "text-white"}`}>{team.name}</div>
        <div className="font-display text-4xl leading-none sm:text-5xl" style={{ color: side === userSide ? "var(--lima)" : "var(--rosa)" }}>{score}</div>
      </div>
    </div>
  );

  return (
    <main className="fixed inset-0 z-50 flex flex-col overflow-hidden safe-y" style={{ background: "radial-gradient(120% 80% at 50% 0%, #0c2c4d 0%, #07182b 45%, #050b14 100%)" }}>
      {/* stadium lights */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(40% 26% at 20% 4%, rgba(255,255,255,0.16), transparent 70%), radial-gradient(40% 26% at 80% 4%, rgba(255,255,255,0.16), transparent 70%)" }} />

      {/* header */}
      <div className="relative flex items-center justify-between px-4 pt-4">
        <div className="font-arc text-[10px] font-extrabold uppercase tracking-[0.3em] text-[var(--amarelo)]">
          ★ Disputa de pênaltis {suddenDeath && !decided && <span className="ml-2 rounded-full bg-[#C0182B] px-2 py-0.5 text-white">morte súbita</span>}
        </div>
        {!decided && (
          <button data-sound="confirm" onClick={skip} className="arc-btn arc-btn--paper px-3 py-1 text-[11px]">Pular ⏭</button>
        )}
      </div>

      {/* scoreboard */}
      <div className="relative mx-auto mt-2 flex w-full max-w-2xl items-center gap-3 px-4">
        <TeamHead team={home} side="h" score={scoredH} align="left" />
        <span className="shrink-0 font-arc text-xs font-extrabold uppercase tracking-widest text-white/40">vs</span>
        <TeamHead team={away} side="a" score={scoredA} align="right" />
      </div>
      <div className="relative mx-auto mt-2 flex w-full max-w-2xl items-center justify-between gap-3 px-4">
        <div className="flex flex-wrap gap-1.5">{dotsFor(hKicks).map((s, i) => <Dot key={i} s={s} />)}</div>
        <div className="flex flex-wrap justify-end gap-1.5">{dotsFor(aKicks).map((s, i) => <Dot key={i} s={s} />)}</div>
      </div>

      {/* the scene */}
      <div className="relative mx-auto mt-3 w-full max-w-xl flex-1 px-4 pb-3">
        <div className="relative mx-auto h-full w-full overflow-hidden rounded-2xl border-[3px] border-[var(--ink)]"
          style={{ aspectRatio: "5 / 4", maxHeight: "100%", background: "linear-gradient(#0d3a55 0%, #0d3a55 12%, #15823f 12%, #126e36 100%)" }}>
          {/* crowd specks */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[11%]" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "7px 7px", opacity: showResult && v?.outcome === "goal" ? 0.9 : 0.4, transition: "opacity .2s" }} />

          {/* goal: net + frame */}
          <div className="absolute" style={{ left: "14%", right: "14%", top: "12%", height: "38%" }}>
            <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 9px), repeating-linear-gradient(0deg, rgba(255,255,255,0.22) 0 1px, transparent 1px 9px)" }} />
          </div>
          {/* crossbar + posts */}
          <div className="absolute rounded-full bg-[#FFFDF5]" style={{ left: "12%", right: "12%", top: "11%", height: "3.2%", boxShadow: "0 0 0 2px var(--ink)" }} />
          <div className="absolute rounded-full bg-[#FFFDF5]" style={{ left: "12%", width: "2.6%", top: "11%", height: "39%", boxShadow: "0 0 0 2px var(--ink)" }} />
          <div className="absolute rounded-full bg-[#FFFDF5]" style={{ right: "12%", width: "2.6%", top: "11%", height: "39%", boxShadow: "0 0 0 2px var(--ink)" }} />

          {/* penalty spot */}
          <div className="absolute h-1.5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" style={{ left: `${SPOT.x}%`, top: `${SPOT.y}%` }} />

          {/* net ripple on goal */}
          <AnimatePresence>
            {showResult && v?.outcome === "goal" && (
              <motion.div
                key={`ripple-${idx}`}
                initial={{ scale: 0.2, opacity: 0.9 }}
                animate={{ scale: 1.6, opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${v.ball.x}%`, top: `${v.ball.y}%`, border: "3px solid var(--amarelo)" }}
              />
            )}
          </AnimatePresence>

          {/* keeper */}
          <motion.div
            key={`keeper-${idx}`}
            initial={{ left: `${KEEPER_REST.x}%`, top: `${KEEPER_REST.y}%`, rotate: 0 }}
            animate={keeperTarget}
            transition={{ duration: phase === "kick" ? 0.42 : 0.001, ease: "easeOut" }}
            className="absolute h-[26%] w-[15%] -translate-x-1/2 -translate-y-1/2"
            style={{ transformOrigin: "50% 70%" }}
          >
            <Keeper color={defendingTeam.colors[0]} />
          </motion.div>

          {/* ball */}
          <motion.div
            key={`ball-${idx}`}
            initial={{ left: `${SPOT.x}%`, top: `${SPOT.y}%`, scale: 1 }}
            animate={ballTarget}
            transition={{ duration: phase === "kick" ? 0.5 : 0.001, ease: [0.3, 0.7, 0.4, 1] }}
            className="absolute z-10 h-[9%] w-[9%] -translate-x-1/2 -translate-y-1/2"
          >
            <Ball />
          </motion.div>

          {/* outcome stamp */}
          <AnimatePresence>
            {showResult && v && (
              <motion.div
                key={`stamp-${idx}`}
                initial={{ scale: 1.7, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: -3 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 460, damping: 20 }}
                className="absolute left-1/2 top-[64%] z-20 -translate-x-1/2 rounded-xl border-[3px] border-[var(--ink)] px-5 py-1.5 font-display text-3xl sm:text-4xl shadow-[4px_5px_0_var(--ink)]"
                style={{
                  background: v.outcome === "goal" ? "var(--amarelo)" : v.outcome === "save" ? "var(--ciano)" : "var(--paper)",
                  color: "var(--ink)",
                }}
              >
                {v.outcome === "goal" ? "GOL!" : v.outcome === "save" ? "DEFENDEU!" : "PERDEU!"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* current shooter banner */}
      {!decided && cur && (
        <div className="relative mx-auto mb-4 w-full max-w-md px-4">
          <motion.div
            key={`shooter-${idx}`}
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="flex items-center gap-3 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-4 py-2 shadow-[4px_5px_0_var(--ink)]"
          >
            <span className="text-2xl">{shootingTeam.flag}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-arc text-sm font-extrabold uppercase text-[var(--ink)]">{cur.shooterName}</div>
              <div className="font-arc text-[10px] font-bold uppercase tracking-widest" style={{ color: shootColor === "var(--lima)" ? "#3D8C40" : "#C0182B" }}>
                {suddenDeath ? `${orderInSide}ª cobrança · morte súbita` : `${orderInSide}ª cobrança`} · vai pra bola
              </div>
            </div>
            <span className="font-display text-2xl" style={{ color: "var(--ink)" }}>{phase === "announce" ? "…" : ""}</span>
          </motion.div>
        </div>
      )}

      {/* finale */}
      <AnimatePresence>
        {decided && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/70 p-6 text-center"
          >
            {Array.from({ length: 34 }).map((_, i) => (
              <span key={i} className="confetti absolute h-2 w-3 rounded-sm" aria-hidden
                style={{
                  left: `${(i * 137) % 100}%`,
                  background: ["#FFC53D", "#9ACD1E", "#4DA3FF", "#FF4D5E", "#FFFDF5"][i % 5],
                  animationDuration: `${2.2 + (i % 5) * 0.6}s`, animationDelay: `${(i % 8) * 0.3}s`, animationIterationCount: "infinite",
                }} />
            ))}
            <motion.div initial={{ scale: 0.6, y: 12 }} animate={{ scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 240, damping: 16 }}>
              <div className="font-arc text-xs font-extrabold uppercase tracking-[0.3em]" style={{ color: "var(--amarelo)" }}>
                {userWon ? "Classificado!" : "Eliminado nos pênaltis"}
              </div>
              <div className="my-2 text-6xl">{winnerTeam.flag}</div>
              <div className="font-display text-4xl sm:text-5xl" style={{ color: userWon ? "var(--lima)" : "#FFFDF5" }}>
                {winnerTeam.name.toUpperCase()}
              </div>
              <div className="mt-1 font-display text-3xl text-white/85">{shootout.h} <span className="text-white/40">–</span> {shootout.a}</div>
              <div className="mt-1 font-arc text-[11px] font-bold uppercase tracking-widest text-white/55">nos pênaltis</div>
            </motion.div>
            <button data-sound="confirm" onClick={onDone} className="arc-btn arc-btn--lima arc-btn--card mt-6 px-8 py-3 text-lg">
              Continuar
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
