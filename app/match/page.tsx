"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Pitch from "@/components/Pitch";
import { useCareer, buildUserTeam } from "@/lib/game/store";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import {
  createMatch, tick, aiMaybeAct, applySub, applyTactics, resultOf, winnerOf,
  type LiveMatchState,
} from "@/lib/game/engine";
import { buildAiTeam, currentRound, userFixture, fixtureSeed, ROUND_LABEL } from "@/lib/game/cup";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL } from "@/lib/game/tactics";
import type {
  Card, FormationId, GameStyle, MatchEvent, MatchResult, MatchTeam, Mentality, Position,
} from "@/lib/game/types";

const BASE_TICK_MS = 650;

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}


type Speed = 1 | 1.5 | 2;

interface View {
  minute: number;
  scoreH: number;
  scoreA: number;
  ballX: number;
  ballY: number;
  eventCount: number;
}

export default function MatchPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);

  // engine state lives in a ref; `view` triggers re-renders
  const stateRef = useRef<LiveMatchState | null>(null);
  const metaRef = useRef<{ fixtureId: string; round: number; userSide: "h" | "a"; oppName: string } | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [panel, setPanel] = useState<"feed" | "stats" | "tactics">("feed");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [goalFlash, setGoalFlash] = useState<MatchEvent | null>(null);
  const recordedRef = useRef(false);

  useEffect(() => setMounted(true), []);

  // ── Build the match once ──
  useEffect(() => {
    if (!mounted) return;
    if (!c.cup || !c.draftDone) { router.replace(c.teamName ? "/squad" : "/"); return; }
    if (stateRef.current) return;
    const round = currentRound(c.cup);
    const f = round <= 7 ? userFixture(c.cup, round) : null;
    if (!f) { router.replace("/cup"); return; }

    const userTeam = buildUserTeam(c);
    const userIsHome = f.homeId === "USER";
    const oppId = userIsHome ? f.awayId : f.homeId;
    const aiTeam = buildAiTeam(SQUAD_BY_ID[oppId], round);
    const home: MatchTeam = userIsHome ? userTeam : aiTeam;
    const away: MatchTeam = userIsHome ? aiTeam : userTeam;
    const st = createMatch(home, away, fixtureSeed(c.cup, f), round >= 4);
    stateRef.current = st;
    metaRef.current = {
      fixtureId: f.id, round,
      userSide: userIsHome ? "h" : "a",
      oppName: aiTeam.name,
    };
    setView({ minute: 0, scoreH: 0, scoreA: 0, ballX: 50, ballY: 50, eventCount: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted]);

  // ── Game loop ──
  useEffect(() => {
    if (!view || paused || result) return;
    const st = stateRef.current;
    if (!st || st.finished) return;
    const id = setInterval(() => {
      const s = stateRef.current!;
      const meta = metaRef.current!;
      const evs = tick(s);
      aiMaybeAct(s, meta.userSide === "h" ? "a" : "h");
      const goal = evs.find((e) => e.type === "goal");
      if (goal) {
        setGoalFlash(goal);
        setTimeout(() => setGoalFlash(null), 1900);
      }
      setView({
        minute: s.minute, scoreH: s.scoreH, scoreA: s.scoreA,
        ballX: s.ballX, ballY: s.ballY, eventCount: s.events.length,
      });
      if (s.finished) setResult(resultOf(s));
    }, BASE_TICK_MS / speed);
    return () => clearInterval(id);
  }, [view !== null, paused, speed, result]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Record result into the cup (once) ──
  useEffect(() => {
    if (!result || recordedRef.current) return;
    recordedRef.current = true;
    const meta = metaRef.current!;
    c.recordResult(meta.fixtureId, result, meta.round);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function skipToEnd() {
    const s = stateRef.current;
    const meta = metaRef.current;
    if (!s || !meta) return;
    while (!s.finished) {
      tick(s);
      aiMaybeAct(s, meta.userSide === "h" ? "a" : "h");
    }
    setGoalFlash(null);
    setView({ minute: s.minute, scoreH: s.scoreH, scoreA: s.scoreA, ballX: 50, ballY: 50, eventCount: s.events.length });
    setResult(resultOf(s));
  }

  if (!mounted || !view || !stateRef.current || !metaRef.current) return null;
  const st = stateRef.current;
  const meta = metaRef.current;

  if (result) {
    return <ResultScreen result={result} state={st} meta={meta} />;
  }

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-3 sm:px-4 py-4 flex flex-col gap-3">
      <Scoreboard st={st} view={view} round={meta.round} />

      <LivePitch st={st} view={view} goalFlash={goalFlash} speed={speed} />

      {/* Controls */}
      <div className="glass p-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaused((p) => !p)}
            className={`px-5 py-2 rounded-xl font-bold text-sm ${paused ? "btn-hero" : "btn-ghost"}`}
          >
            {paused ? "▶ Retomar" : "⏸ Pausar"}
          </button>
          {([1, 1.5, 2] as Speed[]).map((sp) => (
            <button
              key={sp}
              onClick={() => setSpeed(sp)}
              className={`px-3 py-2 rounded-xl text-sm font-bold transition-all ${
                speed === sp ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"
              }`}
            >
              {sp}x
            </button>
          ))}
        </div>
        <button onClick={skipToEnd} className="btn-ghost px-4 py-2 text-sm font-bold">
          ⏭ Pular para o fim
        </button>
      </div>

      {/* Panels */}
      <div className="glass p-3 flex-1 min-h-[220px]">
        <div className="flex gap-2 mb-3">
          {([["feed", "📣 Narração"], ["stats", "📊 Estatísticas"], ["tactics", "📋 Tática & Subs"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setPanel(k); if (k === "tactics") setPaused(true); }}
              className={`px-4 py-1.5 rounded-full text-xs font-bold ${
                panel === k ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {panel === "feed" && <EventFeed st={st} count={view.eventCount} />}
        {panel === "stats" && <StatsPanel st={st} />}
        {panel === "tactics" && <TacticsPanel st={st} meta={meta} onChanged={() => setView((v) => v && { ...v })} />}
      </div>
    </main>
  );
}

// ── Scoreboard ───────────────────────────────────────────────
function Scoreboard({ st, view, round }: { st: LiveMatchState; view: View; round: number }) {
  return (
    <div className="glass-strong px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex-1 text-right min-w-0">
        <span className="font-display text-lg sm:text-2xl truncate">{st.h.team.flag} {st.h.team.name}</span>
      </div>
      <div className="text-center shrink-0">
        <div className="font-display text-3xl sm:text-4xl tracking-wider">
          {view.scoreH} <span className="text-[var(--muted)]">–</span> {view.scoreA}
        </div>
        <div className="text-[11px] font-bold text-[var(--accent)]">
          {Math.min(90, view.minute)}&apos; · {ROUND_LABEL[round]}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-display text-lg sm:text-2xl truncate">{st.a.team.name} {st.a.team.flag}</span>
      </div>
    </div>
  );
}

// ── 2D live pitch ────────────────────────────────────────────
function LivePitch({ st, view, goalFlash, speed }: {
  st: LiveMatchState; view: View; goalFlash: MatchEvent | null; speed: Speed;
}) {
  const transition = `all ${Math.min(0.65, BASE_TICK_MS / speed / 1000)}s ease-in-out`;
  const ballShift = (view.ballX - 50) / 50; // -1..1

  function dots(side: "h" | "a") {
    const ts = side === "h" ? st.h : st.a;
    const slots = FORMATIONS[ts.team.tactics.formation];
    return ts.team.lineup.map((card, i) => {
      if (!card) return null;
      const s = slots[i];
      // map formation depth (0–100 own→opp) onto half pitch + push toward ball
      const push = side === "h" ? Math.max(0, ballShift) * 14 : Math.max(0, -ballShift) * 14;
      const retreat = side === "h" ? Math.max(0, -ballShift) * 7 : Math.max(0, ballShift) * 7;
      const depth = 3 + s.x * 0.44 + push - retreat;
      const fx = side === "h" ? depth : 100 - depth;
      const fy = side === "h" ? s.y : 100 - s.y;
      const isGk = s.pos === "GK";
      return (
        <div
          key={card.player.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
          style={{ left: `${fx}%`, top: `${fy}%`, transition }}
        >
          <div
            className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border"
            style={{
              background: isGk ? "#FFC53D" : ts.team.colors[0],
              borderColor: "rgba(0,0,0,0.5)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.6)",
            }}
          />
          <span className="text-[7px] sm:text-[8px] font-bold text-white/90 bg-black/50 rounded px-0.5 mt-0.5 whitespace-nowrap">
            {shortName(card.player.name)}
          </span>
        </div>
      );
    });
  }

  return (
    <div className="relative">
      {/* Crowd strip */}
      <div className="h-5 mb-1 rounded-t-xl overflow-hidden flex items-center justify-center gap-[3px] bg-[#101826] px-2">
        {Array.from({ length: 60 }).map((_, i) => (
          <span
            key={i}
            className="crowd-dot inline-block w-1.5 h-1.5 rounded-full shrink-0"
            style={{
              background: ["#FFC53D", "#00FF87", "#4DA3FF", "#FF4D5E", "#EAF2EC"][i % 5],
              animationDelay: `${(i % 12) * 0.2}s`,
              opacity: 0.7,
            }}
            aria-hidden
          />
        ))}
      </div>

      <Pitch horizontal className="aspect-[16/9] w-full">
        {dots("h")}
        {dots("a")}
        {/* Ball */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${view.ballX}%`, top: `${view.ballY}%`, transition }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
        </div>

        {/* Goal overlay */}
        <AnimatePresence>
          {goalFlash && (
            <motion.div
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55"
            >
              <motion.div
                initial={{ y: 18 }}
                animate={{ y: 0 }}
                className="font-display text-5xl sm:text-7xl text-[var(--accent)] text-glow"
              >
                GOOOOOL!
              </motion.div>
              <div className="text-base sm:text-lg font-bold mt-2 text-center px-6">{goalFlash.text}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Pitch>
    </div>
  );
}

// ── Event feed ───────────────────────────────────────────────
function EventFeed({ st, count }: { st: LiveMatchState; count: number }) {
  const events = useMemo(() => [...st.events].reverse(), [count]); // eslint-disable-line react-hooks/exhaustive-deps
  const icon: Record<string, string> = {
    goal: "⚽", save: "🧤", miss: "💨", post: "🥅", card: "🟨",
    sub: "🔁", halftime: "⏸️", fulltime: "🏁", kickoff: "🏟️", chance: "⚡",
    tactic: "📋", "penalty-goal": "🥅", "penalty-miss": "🥅",
  };
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {events.map((e, i) => (
          <motion.div
            key={count - i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-start gap-2 text-sm rounded-lg px-2 py-1.5 ${
              e.type === "goal" ? "bg-[rgba(0,255,135,0.1)] border border-[rgba(0,255,135,0.25)]" : ""
            }`}
          >
            <span className="font-display text-[var(--muted)] w-8 shrink-0 text-right">{e.min}&apos;</span>
            <span className="shrink-0">{icon[e.type] ?? "•"}</span>
            <span className={e.type === "goal" ? "font-bold" : ""}>{e.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────
function StatsPanel({ st }: { st: LiveMatchState }) {
  const rows: [string, number, number][] = [
    ["Posse de bola (%)", st.statsH.possession, st.statsA.possession],
    ["Finalizações", st.statsH.shots, st.statsA.shots],
    ["No gol", st.statsH.onTarget, st.statsA.onTarget],
    ["Escanteios", st.statsH.corners, st.statsA.corners],
    ["Faltas", st.statsH.fouls, st.statsA.fouls],
  ];
  return (
    <div className="space-y-3 max-w-xl mx-auto">
      {rows.map(([label, h, a]) => {
        const total = Math.max(1, h + a);
        return (
          <div key={label}>
            <div className="flex justify-between text-sm font-bold mb-1">
              <span className="text-[var(--accent)]">{h}</span>
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{label}</span>
              <span className="text-[var(--blue)]">{a}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden flex">
              <div className="bg-[var(--accent)] transition-all duration-500" style={{ width: `${(h / total) * 100}%` }} />
              <div className="flex-1" />
              <div className="bg-[var(--blue)] transition-all duration-500" style={{ width: `${(a / total) * 100}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── In-match tactics & subs ──────────────────────────────────
function TacticsPanel({ st, meta, onChanged }: {
  st: LiveMatchState;
  meta: { userSide: "h" | "a" };
  onChanged: () => void;
}) {
  const ts = meta.userSide === "h" ? st.h : st.a;
  const slots = FORMATIONS[ts.team.tactics.formation];
  const [subOut, setSubOut] = useState<string | null>(null);

  function setTactic(part: Partial<{ formation: FormationId; mentality: Mentality; style: GameStyle }>) {
    applyTactics(st, meta.userSide, { ...ts.team.tactics, ...part });
    onChanged();
  }
  function doSub(inId: string) {
    if (!subOut) return;
    applySub(st, meta.userSide, subOut, inId);
    setSubOut(null);
    onChanged();
  }

  return (
    <div className="grid sm:grid-cols-2 gap-4 max-h-72 overflow-y-auto pr-1">
      <div className="space-y-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">Formação</div>
          <div className="flex flex-wrap gap-1.5">
            {FORMATION_IDS.map((f) => (
              <button key={f} onClick={() => setTactic({ formation: f })}
                className={`px-3 py-1.5 rounded-lg text-sm font-display ${ts.team.tactics.formation === f ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">Mentalidade</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
              <button key={m} onClick={() => setTactic({ mentality: m })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ts.team.tactics.mentality === m ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
                {MENTALITY_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">Estilo</div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(STYLE_LABEL) as GameStyle[]).map((s) => (
              <button key={s} onClick={() => setTactic({ style: s })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ts.team.tactics.style === s ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
                {STYLE_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
          Substituições restantes: <span className="text-[var(--accent)]">{ts.subsLeft}</span>
        </div>
        {ts.subsLeft === 0 ? (
          <p className="text-sm text-[var(--muted)]">Sem substituições restantes.</p>
        ) : !subOut ? (
          <div className="space-y-1">
            <p className="text-xs text-[var(--muted)] mb-1">Quem sai?</p>
            {ts.team.lineup.map((card, i) => card && (
              <button key={card.player.id} onClick={() => setSubOut(card.player.id)}
                className="w-full btn-ghost px-3 py-1.5 text-left text-sm flex justify-between items-center">
                <span>{slots[i].pos} · {card.player.name}</span>
                <span className="text-xs text-[var(--muted)]">⚡ {Math.round(ts.stamina[card.player.id] ?? 100)}%</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            <button onClick={() => setSubOut(null)} className="text-xs text-[var(--muted)] hover:text-white mb-1">← cancelar</button>
            <p className="text-xs text-[var(--muted)] mb-1">Quem entra?</p>
            {ts.team.bench.length === 0 && <p className="text-sm text-[var(--muted)]">Banco vazio.</p>}
            {ts.team.bench.map((card) => (
              <button key={card.player.id} onClick={() => doSub(card.player.id)}
                className="w-full btn-ghost px-3 py-1.5 text-left text-sm flex justify-between items-center">
                <span>{card.player.name}</span>
                <span className="font-display text-[var(--accent)]">{card.player.ovr}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Post-match ───────────────────────────────────────────────
function ResultScreen({ result, state, meta }: {
  result: MatchResult;
  state: LiveMatchState;
  meta: { fixtureId: string; round: number; userSide: "h" | "a" };
}) {
  const router = useRouter();
  const c = useCareer();
  const [detail, setDetail] = useState<{ card: Card; pos: Position | null } | null>(null);

  const w = winnerOf(result);
  const userWon = w === meta.userSide;
  const draw = w === "draw";

  const teamCards = (side: "h" | "a"): { card: Card; pos: Position | null }[] => {
    const ts = side === "h" ? state.h : state.a;
    const slots = FORMATIONS[ts.team.tactics.formation];
    const posOf = new Map<string, Position>();
    ts.team.lineup.forEach((card, i) => { if (card) posOf.set(card.player.id, slots[i].pos); });
    // roster filtered to whoever actually played (has match stats)
    return ts.roster
      .filter((card) => result.playerStats[card.player.id])
      .map((card) => ({ card, pos: posOf.get(card.player.id) ?? null }));
  };

  const motmEntry = useMemo(() => {
    if (!result.motmId) return null;
    for (const side of ["h", "a"] as const) {
      const found = teamCards(side).find((e) => e.card.player.id === result.motmId);
      if (found) return { ...found, side };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.motmId]);

  // other matches of the same round (from the freshly updated cup)
  const others = (c.cup?.fixtures ?? []).filter(
    (f) => f.round === meta.round && f.id !== meta.fixtureId && f.scoreH !== null
  );

  const ratingColor = (r: number) =>
    r >= 8 ? "bg-[var(--accent)] text-[#04130B]"
    : r >= 7 ? "bg-[var(--gold)] text-black"
    : r >= 6 ? "bg-[var(--surface-2)] text-white"
    : "bg-[var(--red)] text-white";

  function RatingList({ side }: { side: "h" | "a" }) {
    const entries = teamCards(side);
    const ts = side === "h" ? state.h : state.a;
    return (
      <div className="glass p-4">
        <h3 className="font-display text-lg mb-2 flex items-center gap-2">
          <span>{ts.team.flag}</span> {ts.team.name}
        </h3>
        <div className="space-y-1">
          {entries
            .sort((a, b) => (result.playerStats[b.card.player.id]?.rating ?? 0) - (result.playerStats[a.card.player.id]?.rating ?? 0))
            .map(({ card, pos }) => {
              const ps = result.playerStats[card.player.id];
              if (!ps) return null;
              return (
                <button
                  key={card.player.id}
                  onClick={() => setDetail({ card, pos })}
                  className="w-full flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-[var(--surface)] transition-colors text-left"
                >
                  <span className={`w-9 text-center rounded-md font-display shrink-0 ${ratingColor(ps.rating)}`}>
                    {ps.rating.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-[var(--muted)] w-6 shrink-0">{pos ?? ""}</span>
                  <span className="flex-1 truncate font-semibold">{card.player.name}</span>
                  <span className="shrink-0 text-xs">
                    {"⚽".repeat(Math.min(4, ps.goals))}{"🅰️".repeat(Math.min(3, ps.assists))}{ps.cards > 0 ? "🟨" : ""}
                    {card.player.id === result.motmId ? " ⭐" : ""}
                  </span>
                </button>
              );
            })}
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 space-y-5">
      {/* Final score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong p-6 text-center relative overflow-hidden"
      >
        <div className={`absolute inset-0 pointer-events-none ${userWon ? "bg-gradient-to-b from-[rgba(0,255,135,0.12)] to-transparent" : draw ? "" : "bg-gradient-to-b from-[rgba(255,77,94,0.10)] to-transparent"}`} />
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--muted)] mb-2">
          Fim de jogo · {ROUND_LABEL[meta.round]}
        </div>
        <div className="font-display text-2xl sm:text-4xl flex items-center justify-center gap-4 flex-wrap">
          <span>{state.h.team.flag} {state.h.team.name}</span>
          <span className="text-5xl sm:text-6xl text-[var(--accent)]">{result.scoreH}–{result.scoreA}</span>
          <span>{state.a.team.name} {state.a.team.flag}</span>
        </div>
        {result.pensH != null && (
          <div className="text-sm text-[var(--gold)] font-bold mt-1">
            Pênaltis: {result.pensH}–{result.pensA}
          </div>
        )}
        <div className={`mt-3 font-display text-xl ${userWon ? "text-[var(--accent)]" : draw ? "text-[var(--gold)]" : "text-[var(--red)]"}`}>
          {userWon ? "🎉 VITÓRIA!" : draw ? "🤝 EMPATE" : "😤 DERROTA"}
        </div>
      </motion.div>

      {/* MOTM */}
      {motmEntry && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass p-4 flex items-center gap-4 border border-[rgba(255,197,61,0.35)]"
        >
          <div className="text-4xl">⭐</div>
          <div className="flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--gold)]">Craque da partida</div>
            <div className="font-display text-xl">{motmEntry.card.flag} {motmEntry.card.player.name}</div>
            <div className="text-xs text-[var(--muted)]">{motmEntry.card.nation} {motmEntry.card.year}</div>
          </div>
          <div className="font-display text-3xl text-[var(--gold)]">
            {result.playerStats[motmEntry.card.player.id]?.rating.toFixed(1)}
          </div>
        </motion.div>
      )}

      {/* Ratings */}
      <div className="grid sm:grid-cols-2 gap-4">
        <RatingList side={meta.userSide} />
        <RatingList side={meta.userSide === "h" ? "a" : "h"} />
      </div>

      {/* Other results */}
      {others.length > 0 && (
        <div className="glass p-4">
          <h3 className="font-display text-lg mb-3">🌍 Aconteceu ao mesmo tempo…</h3>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
            {others.map((f) => (
              <div key={f.id} className="text-sm border-b border-[var(--border)] pb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate">{c.cup!.teams[f.homeId].flag} {c.cup!.teams[f.homeId].name}</span>
                  <span className="font-display shrink-0">{f.scoreH}–{f.scoreA}{f.pensH != null ? ` (${f.pensH}–${f.pensA} pen)` : ""}</span>
                  <span className="truncate text-right">{c.cup!.teams[f.awayId].name} {c.cup!.teams[f.awayId].flag}</span>
                </div>
                {f.scorers && f.scorers.length > 0 && (
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    ⚽ {f.scorers.map((s) => `${s.name} ${s.min}'`).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => { c.clearLastResult(); router.push("/cup"); }}
        className="btn-hero w-full py-4 text-lg"
      >
        Continuar →
      </button>

      {/* Player detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
              className="glass-strong p-6 w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const ps = result.playerStats[detail.card.player.id];
                return (
                  <>
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-1">{detail.card.flag}</div>
                      <div className="font-display text-2xl">{detail.card.player.name}</div>
                      <div className="text-xs text-[var(--muted)]">
                        {detail.card.nation} {detail.card.year} · OVR {detail.card.player.ovr}
                        {detail.card.player.id === result.motmId ? " · ⭐ Craque da partida" : ""}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Nota", ps?.rating.toFixed(1) ?? "—"],
                        ["Gols", ps?.goals ?? 0],
                        ["Assist.", ps?.assists ?? 0],
                        ["Chutes", ps?.shots ?? 0],
                        ["Defesas", ps?.saves ?? 0],
                        ["Cartões", ps?.cards ?? 0],
                      ].map(([label, v]) => (
                        <div key={label as string} className="glass p-3">
                          <div className="font-display text-xl text-[var(--accent)]">{v}</div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => setDetail(null)} className="btn-ghost w-full py-2.5 mt-4 font-bold">
                      Fechar
                    </button>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
