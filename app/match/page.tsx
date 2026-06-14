"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SoundProvider from "@/src/audio/SoundProvider";
import MatchStage from "@/src/match/presentation/MatchStage";
import { createDirector, type Director } from "@/src/match/presentation/director";
import { useCareer, buildUserTeam, USER_COLORS, USER_KIT2 } from "@/lib/game/store";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import { EDITION_BY_ID, DEFAULT_EDITION_ID } from "@/lib/data/editions";
import { stadiumProfile, type StadiumProfile } from "@/lib/data/stadiums";
import {
  createMatch, tick, aiMaybeAct, applySub, applyTactics, resultOf, winnerOf, mulberry32,
  type LiveMatchState,
} from "@/lib/game/engine";
import { buildAiTeam, nextUserFixture, fixtureSeed, roundLabel } from "@/lib/game/cup";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL } from "@/lib/game/tactics";
import { sound } from "@/src/audio/SoundManager";
import {
  IconAssist, IconBall, IconCard, IconChart, IconCrowd, IconGlove, IconSnow,
  IconStadium, IconStar, IconSub, IconWeather, IconWhistle,
} from "@/components/icons";
import KitJersey, { type KitPattern } from "@/components/game/KitJersey";
import PenaltyShootout from "@/components/game/PenaltyShootout";
import type {
  Card, Fixture, FormationId, GameStyle, MatchEvent, MatchResult, MatchTeam, Mentality,
  PitchEra, Position, SquadDef, Stadium, WCEdition,
} from "@/lib/game/types";
import { POSITION_SHORT, POSITION_SECTOR } from "@/lib/game/types";

const BASE_TICK_MS = 1100; // 1× is cinematic/readable; 1.5×/2× divide this

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}

type Speed = 1 | 1.5 | 2;
type WeatherKind = "sun" | "clouds" | "rain" | "heat" | "night";

interface View {
  minute: number;
  scoreH: number;
  scoreA: number;
  possH: number;
  eventCount: number;
}

interface PreInfo {
  f: Fixture;
  ed: WCEdition;
  seed: number;
  stadiumStr: string;
  stRec: Stadium;
  attendance: number;
  weather: WeatherKind;
  weatherLabel: string;
  userIsHome: boolean;
  oppId: string;
  oppSquad: SquadDef;
}

interface Meta {
  fixture: Fixture;
  round: number;
  userSide: "h" | "a";
  oppName: string;
  era: PitchEra;
  stadium: string;
  stadiumProfile: StadiumProfile | null;
  capacity: number;
  attendance: number;
  weather: WeatherKind;
  weatherLabel: string;
}

function colorDist(a: string, b: string): number {
  const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

export default function MatchPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"pre" | "live">("pre");

  const stateRef = useRef<LiveMatchState | null>(null);
  const metaRef = useRef<Meta | null>(null);
  const directorRef = useRef<Director | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [panel, setPanel] = useState<"feed" | "stats">("feed");
  const [tacticsOpen, setTacticsOpen] = useState(false);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [shootoutDone, setShootoutDone] = useState(false);
  const [goalFlash, setGoalFlash] = useState<MatchEvent | null>(null);
  const [cooling, setCooling] = useState(false);
  const recordedRef = useRef(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => () => sound.stopAmbience(), []);

  // ── Resolve the fixture & ambiance (pre-match) ──
  const pre = useMemo((): PreInfo | null => {
    if (!mounted || !c.cup || !c.draftDone) return null;
    const f = nextUserFixture(c.cup);
    if (!f) return null;
    const ed = EDITION_BY_ID[c.cup.editionId] ?? EDITION_BY_ID[DEFAULT_EDITION_ID];
    const seed = fixtureSeed(c.cup, f);
    const r = mulberry32(seed ^ 0x5bd1e995);
    const stadiumStr = f.stadium ?? `${ed.stadiums[0].name} · ${ed.stadiums[0].city}`;
    const stName = stadiumStr.split(" · ")[0];
    const stRec = ed.stadiums.find((s) => s.name === stName) ?? ed.stadiums[0];
    const fillRate = 0.72 + 0.27 * Math.min(1, (f.round - 1) / 8 + r() * 0.6);
    const attendance = Math.round(stRec.capacity * Math.min(1, fillRate) / 100) * 100;
    const isQatar = ed.id === "catar-2022";
    const weather: WeatherKind = isQatar
      ? (r() < 0.5 ? "heat" : "night")
      : (["sun", "clouds", "rain", "night", "sun"] as WeatherKind[])[Math.floor(r() * 5)];
    const weatherLabel: Record<WeatherKind, string> = {
      sun: "Sol firme", clouds: "Nublado", rain: "Chuva fina", heat: "Calor intenso", night: "Noite limpa",
    };
    const userIsHome = f.homeId === "USER";
    const oppId = userIsHome ? f.awayId : f.homeId;
    const oppSquad = SQUAD_BY_ID[oppId];
    if (!oppSquad) return null;
    return {
      f, ed, seed, stadiumStr, stRec, attendance, weather,
      weatherLabel: weatherLabel[weather],
      userIsHome, oppId, oppSquad,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, c.cup, c.draftDone]);

  useEffect(() => {
    if (!mounted) return;
    if (!c.cup || !c.draftDone) { router.replace(c.coachName ? "/squad" : "/"); return; }
    if (!pre) router.replace("/cup");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, pre]);

  function kickoff() {
    if (!pre || stateRef.current) return;
    const userTeam = buildUserTeam(c);
    let aiTeam = buildAiTeam(pre.oppSquad, pre.f.round);
    // kit clash: opponent switches to its 2nd kit if needed (2nd kit is plain)
    if (colorDist(aiTeam.colors[0], userTeam.colors[0]) < 160) {
      aiTeam = { ...aiTeam, colors: pre.oppSquad.kit2, kitPattern: "solid" };
    }
    const home: MatchTeam = pre.userIsHome ? userTeam : aiTeam;
    const away: MatchTeam = pre.userIsHome ? aiTeam : userTeam;
    const coolingBreaks = pre.ed.year >= 2022 || pre.weather === "heat";
    const st = createMatch(home, away, pre.seed, pre.f.knockout, coolingBreaks);
    stateRef.current = st;
    metaRef.current = {
      fixture: pre.f, round: pre.f.round,
      userSide: pre.userIsHome ? "h" : "a",
      oppName: aiTeam.name,
      era: pre.ed.era,
      stadium: pre.stadiumStr,
      stadiumProfile: stadiumProfile(pre.stadiumStr.split(" · ")[0], pre.ed.year),
      capacity: pre.stRec.capacity,
      attendance: pre.attendance,
      weather: pre.weather,
      weatherLabel: pre.weatherLabel,
    };
    // the director owns the game loop from here: it ticks the engine lazily
    // and choreographs each minute; the page only renders HUD + overlays
    directorRef.current = createDirector(st, {
      userSide: pre.userIsHome ? "h" : "a",
      presSeed: pre.seed ^ 0x9d2c5680,
      audio: sound,
      baseMinuteMs: BASE_TICK_MS,
      onView: (v) => setView(v),
      onEvents: (evs) => {
        const goal = evs.find((e) => e.type === "goal");
        if (goal) {
          setGoalFlash(goal);
          setTimeout(() => setGoalFlash(null), 2600);
        } else if (evs.length) {
          sound.play("ui.tick");
        }
        if (evs.some((e) => e.type === "cooling")) {
          setCooling(true);
          setTimeout(() => setCooling(false), 1800);
        }
      },
      onFinished: () => {
        const s = stateRef.current;
        if (s) setResult(resultOf(s));
      },
    });
    sound.play("whistle.kickoff");
    sound.ambience("crowd.loop", { intensity: 0.5 });
    setView({ minute: 0, scoreH: 0, scoreA: 0, possH: 50, eventCount: 1 });
    setPhase("live");
  }

  // ── Record result into the cup (once) ──
  useEffect(() => {
    if (!result || recordedRef.current) return;
    recordedRef.current = true;
    sound.stopAmbience();
    const meta = metaRef.current!;
    c.recordResult(meta.fixture.id, result, meta.round);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function skipToEnd() {
    const s = stateRef.current;
    const meta = metaRef.current;
    if (!s || !meta) return;
    directorRef.current?.destroy();
    while (!s.finished) {
      tick(s);
      aiMaybeAct(s, meta.userSide === "h" ? "a" : "h");
    }
    setGoalFlash(null);
    setCooling(false);
    setView({ minute: s.minute, scoreH: s.scoreH, scoreA: s.scoreA, possH: s.statsH.possession, eventCount: s.events.length });
    setResult(resultOf(s));
  }

  if (!mounted || !pre) return null;

  if (phase === "pre" && !result) {
    return <PreMatch pre={pre} onKickoff={kickoff} />;
  }

  if (!view || !stateRef.current || !metaRef.current) return null;
  const st = stateRef.current;
  const meta = metaRef.current;

  // knockout draw → animated shootout before the result screen
  if (result?.penShootout && !shootoutDone) {
    return (
      <PenaltyShootout
        shootout={result.penShootout}
        home={st.h.team}
        away={st.a.team}
        userSide={meta.userSide}
        seed={pre.seed}
        onDone={() => setShootoutDone(true)}
      />
    );
  }

  if (result) {
    return <ResultScreen result={result} state={st} meta={meta} />;
  }

  const closeTactics = () => {
    setTacticsOpen(false);
    directorRef.current?.syncLineups();
    sound.play("whistle.kickoff");
  };

  return (
    <main className="arc-bg flex-1 w-full safe-x safe-b">
      <SoundProvider />
      <div className="mx-auto max-w-5xl w-full px-3 sm:px-4 py-4 flex flex-col gap-3">
        <Scoreboard st={st} view={view} meta={meta} />
        <PossessionBar st={st} view={view} />

        {/* Pixi stage + DOM overlays (HUD only). Taller on phones (4:3) so the
            players read big in portrait; landscape 16:10 on larger screens. */}
        <div className={goalFlash ? "shake" : ""}>
          <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full rounded-2xl overflow-hidden border-[3px] border-[var(--ink)]">
            {directorRef.current && (
              <MatchStage
                director={directorRef.current}
                era={meta.era}
                paused={paused || tacticsOpen}
                speed={speed}
                homeColor={st.h.team.colors[0]}
                awayColor={st.a.team.colors[0]}
                crowdSeed={pre.seed ^ 0x51ab3c}
                crowdDensity={meta.attendance / meta.capacity}
                stadium={meta.stadiumProfile}
              />
            )}

            {/* Cooling break overlay */}
            <AnimatePresence>
              {cooling && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[rgba(10,20,40,0.6)] pointer-events-none"
                >
                  <IconSnow size={40} className="text-[#9CD2FF] mb-2" />
                  <div className="font-display text-2xl text-[#9CD2FF]">COOLING BREAK</div>
                  <div className="text-xs text-white/70">hidratação à beira do campo</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Goal banner — non-blocking strip so the celebration stays visible */}
            <AnimatePresence>
              {goalFlash && (
                <motion.div
                  initial={{ opacity: 0, y: -16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="absolute top-2 inset-x-0 z-20 flex flex-col items-center pointer-events-none"
                >
                  <div className="arc-logo text-4xl sm:text-6xl" style={{ color: "var(--amarelo)", textShadow: "0 2px 0 var(--ink)" }}>
                    GOOOOOL!
                  </div>
                  <div className="font-arc text-xs sm:text-sm font-extrabold text-white bg-black/65 rounded-lg px-3 py-1 mt-1 text-center max-w-[90%]">
                    {goalFlash.text}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls — wrap into tidy tappable clusters on phones */}
        <div className="arc-strip !rounded-2xl px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              data-sound="confirm"
              onClick={() => setPaused((p) => !p)}
              className={`arc-btn tap-sm px-4 py-1.5 text-xs ${paused ? "arc-btn--lima" : "arc-btn--paper"}`}
            >
              {paused ? "Retomar" : "Pausar"}
            </button>
            {([1, 1.5, 2] as Speed[]).map((sp) => (
              <button
                key={sp}
                data-sound="confirm"
                onClick={() => setSpeed(sp)}
                className={`arc-btn tap-sm px-3 py-1.5 text-xs ${speed === sp ? "" : "arc-btn--paper"}`}
              >
                {sp}x
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              data-sound="confirm"
              onClick={() => setTacticsOpen(true)}
              className="arc-btn tap-sm px-4 py-1.5 text-xs"
            >
              TÁTICA
            </button>
            <button data-sound="confirm" onClick={skipToEnd} className="arc-btn arc-btn--ciano tap-sm px-4 py-1.5 text-xs">
              Pular pro fim
            </button>
          </div>
        </div>

        {/* Panels: narration & stats only — tactics live in the overlay */}
        <div className="arc-panel p-3 flex-1 min-h-[220px]">
          <div className="flex gap-2 mb-3">
            {([["feed", "Narração"], ["stats", "Estatísticas"]] as const).map(([k, label]) => (
              <button
                key={k}
                data-sound="confirm"
                onClick={() => setPanel(k)}
                className={`arc-btn tap-sm px-4 py-1 text-[11px] ${panel === k ? "" : "arc-btn--paper"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {panel === "feed" && <EventFeed st={st} count={view.eventCount} />}
          {panel === "stats" && <StatsBars statsH={st.statsH} statsA={st.statsA} />}
        </div>

        {/* TÁTICA overlay — full-screen, pauses the show (sim is deterministic, pausing is safe) */}
        <AnimatePresence>
          {tacticsOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-3 sm:p-6 bg-black/75 safe-y"
            >
              <motion.div
                initial={{ scale: 0.95, y: 18 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 10 }}
                className="arc-panel my-auto p-4 sm:p-6 w-full max-w-5xl max-h-[88dvh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="font-display text-2xl">VESTIÁRIO</div>
                    <div className="font-arc text-[10px] font-bold opacity-55 uppercase tracking-widest">
                      jogo pausado · {Math.min(90, view.minute)}&apos; · {view.scoreH}–{view.scoreA}
                    </div>
                  </div>
                  <button data-sound="confirm" onClick={closeTactics} className="arc-btn arc-btn--lima px-4 py-2 text-xs">
                    <span className="inline-flex items-center gap-1.5"><IconWhistle size={14} /> Voltar ao jogo</span>
                  </button>
                </div>
                <TacticsPanel
                  st={st}
                  meta={meta}
                  morale={c.morale}
                  onChanged={() => { directorRef.current?.syncLineups(); setView((v) => v && { ...v }); }}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// ── Pre-match building blocks (PS2 face-off) ─────────────────
const DOT_BY_SECTOR: Record<string, string> = {
  GK: "var(--amarelo)", DEF: "#4DA3FF", MID: "var(--lima)", ATT: "#FF4D5E",
};
function sectorOf(p: Position): string {
  if (p === "GK") return "GK";
  if (p === "RB" || p === "CB" || p === "LB") return "DEF";
  if (p === "DM" || p === "CM" || p === "AM") return "MID";
  return "ATT";
}

/** Compact lineup list: POS · name · rating. */
function LineupRows({ team }: { team: MatchTeam }) {
  const slots = FORMATIONS[team.tactics.formation];
  return (
    <div className="space-y-0.5">
      {team.lineup.map((card, i) => card && (
        <div key={card.player.id} className="flex items-center gap-2 py-0.5 text-xs">
          <span className="w-8 font-arc text-[9px] font-extrabold opacity-50">{POSITION_SHORT[slots[i].pos]}</span>
          <span className="min-w-0 flex-1 truncate font-arc font-bold">{card.player.name}</span>
          <span className="font-display text-[var(--accent)]">{effectiveOvr(card, slots[i].pos)}</span>
        </div>
      ))}
    </div>
  );
}

/** PES-style mini-pitch: colored dots over a striped field; header has the
 * formation and ‹ › arrows (editable side only) that cycle it live, dots
 * sliding to the new shape via layout animation. */
function MiniPitch({ formation, editable, onCycle }: {
  formation: FormationId; editable?: boolean; onCycle?: (dir: number) => void;
}) {
  const slots = FORMATIONS[formation];
  return (
    <div className="overflow-hidden rounded-xl border-[3px] border-[var(--ink)] shadow-[2px_3px_0_var(--ink)]">
      <div className="flex items-center justify-between bg-[var(--ink)] px-2 py-1 text-[var(--paper)]">
        {editable ? (
          <button data-sound="tab" onClick={() => onCycle?.(-1)} className="px-1.5 font-display text-lg leading-none hover:text-[var(--amarelo)]">‹</button>
        ) : <span className="w-5" />}
        <span className="font-arc text-xs font-extrabold tracking-wide">{formation}</span>
        {editable ? (
          <button data-sound="tab" onClick={() => onCycle?.(1)} className="px-1.5 font-display text-lg leading-none hover:text-[var(--amarelo)]">›</button>
        ) : <span className="w-5" />}
      </div>
      <div className="relative aspect-[3/4]" style={{ background: "repeating-linear-gradient(0deg, #1E8746 0 11%, #1a7a3e 11% 22%)" }}>
        {slots.map((s, i) => (
          <motion.span
            key={i}
            layout
            transition={{ type: "spring", stiffness: 460, damping: 32 }}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-[var(--ink)]"
            style={{ left: `${s.y}%`, bottom: `${s.x}%`, background: DOT_BY_SECTOR[sectorOf(s.pos)] }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

/** One half of the face-off: slides in from its edge. */
function TeamSide({ team, accent, kitColors, kitPattern, slideFrom, editable, onCycle, onEdit }: {
  team: MatchTeam; accent: string; kitColors: [string, string]; kitPattern: KitPattern; slideFrom: number;
  editable?: boolean; onCycle?: (dir: number) => void; onEdit?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: slideFrom * 56 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="arc-panel min-w-0 p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-arc text-[10px] font-extrabold uppercase tracking-widest opacity-55">
            {MENTALITY_LABEL[team.tactics.mentality]} · {STYLE_LABEL[team.tactics.style]}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-2xl leading-none">{team.flag}</span>
            <span className="min-w-0 truncate font-display text-2xl leading-none" style={{ color: accent }}>{team.name}</span>
          </div>
        </div>
        <KitJersey primary={kitColors[0]} secondary={kitColors[1]} pattern={kitPattern} className="w-9 h-auto shrink-0" />
      </div>

      <MiniPitch formation={team.tactics.formation} editable={editable} onCycle={onCycle} />

      <div className="mt-3 max-h-44 overflow-y-auto pr-1">
        <LineupRows team={team} />
      </div>

      {editable && (
        <button data-sound="confirm" onClick={onEdit} className="arc-btn arc-btn--paper mt-3 w-full py-2 text-xs">
          Editar escalação →
        </button>
      )}
    </motion.div>
  );
}

/** Central strip: VS + strengths, match metadata, kit choice, kickoff CTA. */
function CenterStrip({ uo, oo, pre, f, userKit, userColors1, userColors2, userPattern1, userPattern2, onKit, onKickoff }: {
  uo: number; oo: number; pre: PreInfo; f: Fixture;
  userKit: 1 | 2; userColors1: [string, string]; userColors2: [string, string];
  userPattern1: KitPattern; userPattern2: KitPattern;
  onKit: (k: 1 | 2) => void; onKickoff: () => void;
}) {
  const cup = useCareer().cup!;
  return (
    <div className="flex flex-col gap-3">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.12 }}
        className="arc-strip px-4 py-4 text-center"
      >
        <div className="mb-1 font-arc text-[10px] font-extrabold uppercase tracking-[0.3em]" style={{ color: "var(--amarelo)" }}>
          {roundLabel(cup, f.round)}{f.group ? ` · Grupo ${f.group}` : ""}
        </div>
        <div className="font-display text-5xl leading-none" style={{ color: "var(--amarelo)" }}>VS</div>
        <div className="mt-2 flex items-center justify-center gap-3 font-display text-2xl">
          <span style={{ color: "var(--lima)" }}>{Math.round(uo)}</span>
          <span className="text-base text-white/40">×</span>
          <span style={{ color: "var(--rosa)" }}>{Math.round(oo)}</span>
        </div>
      </motion.div>

      <div className="arc-panel p-3">
        <div className="flex flex-col gap-1 font-arc text-[11px] font-bold text-[rgba(20,21,18,0.8)]">
          <span className="flex items-center justify-center gap-1.5"><IconStadium size={13} /> {pre.stadiumStr}</span>
          <span className="flex items-center justify-center gap-1.5"><IconCrowd size={13} /> {pre.attendance.toLocaleString("pt-BR")}</span>
          <span className="flex items-center justify-center gap-1.5"><IconWeather kind={pre.weather} size={13} /> {pre.weatherLabel}</span>
        </div>
      </div>

      <div className="arc-panel p-3">
        <div className="mb-1.5 text-center font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50">Seu uniforme</div>
        <div className="flex justify-center gap-2">
          {([["1º", userColors1, userPattern1, 1], ["2º", userColors2, userPattern2, 2]] as const).map(([lbl, colors, pat, k]) => (
            <button
              key={k}
              data-sound="confirm"
              onClick={() => onKit(k)}
              className={`flex flex-col items-center gap-1 rounded-xl border-[3px] px-3 py-2 ${
                userKit === k ? "border-[var(--ink)] bg-[rgba(154,205,30,0.3)] shadow-[2px_3px_0_var(--ink)]" : "border-[rgba(20,21,18,0.25)]"
              }`}
            >
              <KitJersey primary={colors[0]} secondary={colors[1]} pattern={pat} className="w-11 h-auto" />
              <span className="font-arc text-[9px] font-extrabold uppercase">{lbl}</span>
            </button>
          ))}
        </div>
      </div>

      <button data-sound="confirm" onClick={onKickoff} className="arc-btn arc-btn--lima arc-btn--card w-full py-4">
        <span className="inline-flex items-center gap-2 text-2xl leading-tight"><IconWhistle size={22} /> Apito inicial</span>
        <span className="mt-0.5 block font-arc text-[11px] font-bold opacity-75">fim de papo — bola rolando</span>
      </button>
    </div>
  );
}

// ── Pre-match (PS2 face-off: seu time à esquerda, rival à direita) ─
function PreMatch({ pre, onKickoff }: { pre: PreInfo; onKickoff: () => void }) {
  const router = useRouter();
  const c = useCareer();
  const f = pre.f;
  const userTeam = buildUserTeam(c);
  const oppTeam = useMemo(() => buildAiTeam(pre.oppSquad, f.round), [pre.oppSquad, f.round]);

  // team strength (lineup OVR average) — drives the face-off numbers
  const avg = (t: MatchTeam) => {
    const slots = FORMATIONS[t.tactics.formation];
    return t.lineup.reduce((s, card, i) => s + (card ? effectiveOvr(card, slots[i].pos) : 70), 0) / 11;
  };
  const uo = avg(userTeam), oo = avg(oppTeam);

  const oppClash = colorDist(oppTeam.colors[0], userTeam.colors[0]) < 160;
  const oppKit: [string, string] = oppClash ? pre.oppSquad.kit2 : oppTeam.colors;
  const oppPattern = (oppClash ? "solid" : (oppTeam.kitPattern ?? "solid")) as KitPattern;
  const userKitPattern = ((c.userKit === 2 ? c.userPattern2 : c.userPattern) ?? "solid") as KitPattern;

  // anthem plays through the whole pre-match, cut at the whistle
  useEffect(() => { sound.music("anthem"); }, []);
  const kickoff = () => { sound.stopMusic(300); onKickoff(); };

  const formIdx = FORMATION_IDS.indexOf(c.tactics.formation as FormationId);
  const cycleForm = (dir: number) =>
    c.setFormation(FORMATION_IDS[(formIdx + dir + FORMATION_IDS.length) % FORMATION_IDS.length] as FormationId);

  return (
    <main className="arc-bg w-full flex-1 safe-x safe-b">
      <SoundProvider />
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:py-6">
        {/* On phones the VS / stadium / kit + kickoff CTA come first (order-1);
            the two team line-ups follow for inspection. Desktop keeps the
            classic you · center · rival face-off. */}
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_280px_1fr]">
          <div className="order-2 lg:order-1 min-w-0">
            <TeamSide
              team={userTeam}
              accent="var(--lima)"
              kitColors={userTeam.colors}
              kitPattern={userKitPattern}
              slideFrom={-1}
              editable
              onCycle={cycleForm}
              onEdit={() => router.push("/squad")}
            />
          </div>
          <div className="order-1 lg:order-2 min-w-0">
            <CenterStrip
              uo={uo} oo={oo} pre={pre} f={f}
              userKit={c.userKit}
              userColors1={c.userColors ?? USER_COLORS}
              userColors2={c.userColors2 ?? USER_KIT2}
              userPattern1={(c.userPattern ?? "solid") as KitPattern}
              userPattern2={(c.userPattern2 ?? "solid") as KitPattern}
              onKit={(k) => c.setUserKit(k)}
              onKickoff={kickoff}
            />
          </div>
          <div className="order-3 min-w-0">
            <TeamSide team={oppTeam} accent="var(--rosa)" kitColors={oppKit} kitPattern={oppPattern} slideFrom={1} />
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Scoreboard (faixa preta com valores vivos) ───────────────
function Scoreboard({ st, view, meta }: { st: LiveMatchState; view: View; meta: Meta }) {
  const cup = useCareer().cup!;
  return (
    <div className="arc-strip !rounded-2xl px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right min-w-0 flex items-center justify-end gap-2">
          <span className="font-display text-lg sm:text-2xl truncate">{st.h.team.flag} {st.h.team.name}</span>
          <KitJersey primary={st.h.team.colors[0]} secondary={st.h.team.colors[1]} pattern={(st.h.team.kitPattern ?? "solid") as KitPattern} className="w-6 h-auto shrink-0" />
        </div>
        <div className="text-center shrink-0">
          <div className="font-display text-3xl sm:text-4xl tracking-wider" style={{ color: "var(--amarelo)" }}>
            {view.scoreH} <span className="text-white/40">–</span> {view.scoreA}
          </div>
          <div className="font-arc text-[11px] font-extrabold" style={{ color: "var(--lima)" }}>
            {Math.min(90, view.minute)}&apos; · {roundLabel(cup, meta.round)}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <KitJersey primary={st.a.team.colors[0]} secondary={st.a.team.colors[1]} pattern={(st.a.team.kitPattern ?? "solid") as KitPattern} className="w-6 h-auto shrink-0" />
          <span className="font-display text-lg sm:text-2xl truncate">{st.a.team.name} {st.a.team.flag}</span>
        </div>
      </div>
      <div className="font-arc text-[9px] font-bold text-white/60 text-center mt-1 flex items-center justify-center gap-3 flex-wrap">
        <span className="flex items-center gap-1"><IconStadium size={11} /> {meta.stadium}</span>
        <span className="flex items-center gap-1"><IconCrowd size={11} /> {meta.attendance.toLocaleString("pt-BR")}</span>
        <span className="flex items-center gap-1"><IconWeather kind={meta.weather} size={11} /> {meta.weatherLabel}</span>
      </div>
    </div>
  );
}

// ── Possession bar ───────────────────────────────────────────
function PossessionBar({ st, view }: { st: LiveMatchState; view: View }) {
  const h = view.possH;
  return (
    <div className="px-1">
      <div className="flex justify-between font-arc text-[10px] font-extrabold mb-0.5">
        <span className="px-1.5 rounded bg-black/55" style={{ color: st.h.team.colors[0] }}>{h}%</span>
        <span className="text-white/80 uppercase tracking-widest text-[8px]">posse de bola</span>
        <span className="px-1.5 rounded bg-black/55" style={{ color: st.a.team.colors[0] }}>{100 - h}%</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden flex border-2 border-[var(--ink)] bg-[var(--ink)]">
        <div className="transition-all duration-700" style={{ width: `${h}%`, background: st.h.team.colors[0] }} />
        <div className="flex-1 transition-all duration-700" style={{ background: st.a.team.colors[0] }} />
      </div>
    </div>
  );
}

// ── Event feed ───────────────────────────────────────────────
function EventIcon({ type }: { type: MatchEvent["type"] }) {
  const cls = "shrink-0 mt-0.5";
  switch (type) {
    case "goal": case "penalty-goal": return <IconBall size={14} className={`${cls} text-[var(--accent)]`} />;
    case "save": return <IconGlove size={14} className={`${cls} text-[var(--blue)]`} />;
    case "card": return <IconCard size={14} className={cls} />;
    case "sub": return <IconSub size={14} className={cls} />;
    case "cooling": return <IconSnow size={14} className={`${cls} text-[#2E86C1]`} />;
    case "halftime": case "fulltime": case "kickoff": return <IconWhistle size={14} className={`${cls} text-[var(--gold)]`} />;
    case "post": case "miss": case "penalty-miss": return <IconBall size={14} className={`${cls} text-[var(--muted)]`} />;
    case "tactic": return <IconChart size={14} className={`${cls} text-[var(--muted)]`} />;
    default: return <IconBall size={14} className={`${cls} text-[var(--muted)]`} />;
  }
}

function EventFeed({ st, count }: { st: LiveMatchState; count: number }) {
  // only events the director already "released" — a goal line never appears
  // in the feed before the shot lands on screen
  const events = useMemo(() => st.events.slice(0, count).reverse(), [count]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
      <AnimatePresence initial={false}>
        {events.map((e, i) => (
          <motion.div
            key={count - i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-start gap-2 font-arc text-sm font-semibold rounded-lg px-2 py-1.5 ${
              e.type === "goal" ? "bg-[rgba(154,205,30,0.3)] border-2 border-[rgba(20,21,18,0.3)]" : ""
            }`}
          >
            <span className="font-display text-[var(--muted)] w-8 shrink-0 text-right">{e.min}&apos;</span>
            <EventIcon type={e.type} />
            <span className={e.type === "goal" ? "font-extrabold" : ""}>{e.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Stats ────────────────────────────────────────────────────
function StatsBars({ statsH, statsA }: { statsH: LiveMatchState["statsH"]; statsA: LiveMatchState["statsA"] }) {
  const rows: [string, number, number][] = [
    ["Posse de bola (%)", statsH.possession, statsA.possession],
    ["Finalizações", statsH.shots, statsA.shots],
    ["No gol", statsH.onTarget, statsA.onTarget],
    ["Escanteios", statsH.corners, statsA.corners],
    ["Faltas", statsH.fouls, statsA.fouls],
  ];
  return (
    <div className="space-y-3 max-w-xl mx-auto">
      {rows.map(([label, h, a]) => {
        const total = Math.max(1, h + a);
        return (
          <div key={label}>
            <div className="flex justify-between font-arc text-sm font-extrabold mb-1">
              <span className="text-[var(--accent)]">{h}</span>
              <span className="text-xs text-[var(--muted)] uppercase tracking-wider">{label}</span>
              <span className="text-[var(--blue)]">{a}</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-2)] overflow-hidden flex border border-[rgba(20,21,18,0.3)]">
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

// ── In-match tactics & subs (yours editable, theirs read-only) ─
function TacticsPanel({ st, meta, morale, onChanged }: {
  st: LiveMatchState;
  meta: Meta;
  morale: Record<string, number>;
  onChanged: () => void;
}) {
  const ts = meta.userSide === "h" ? st.h : st.a;
  const opp = meta.userSide === "h" ? st.a : st.h;
  const slots = FORMATIONS[ts.team.tactics.formation];
  const oppSlots = FORMATIONS[opp.team.tactics.formation];
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

  const outIsGk = subOut !== null && (() => {
    const i = ts.team.lineup.findIndex((c) => c?.player.id === subOut);
    return i >= 0 && slots[i].pos === "GK";
  })();

  const benchSorted = subOut
    ? [...ts.team.bench].sort((x, y) => {
        const gx = x.player.positions.includes("GK") ? 1 : 0;
        const gy = y.player.positions.includes("GK") ? 1 : 0;
        return outIsGk ? gy - gx : gx - gy || y.player.ovr - x.player.ovr;
      })
    : ts.team.bench;

  const StaminaBar = ({ v }: { v: number }) => (
    <span className="inline-block w-12 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden align-middle border border-[rgba(20,21,18,0.25)]">
      <span className="block h-full" style={{ width: `${v}%`, background: v >= 65 ? "#3D8C40" : v >= 45 ? "#A87800" : "#C0182B" }} />
    </span>
  );
  const MoraleDot = ({ v }: { v: number }) => (
    <span
      className="inline-block w-2 h-2 rounded-full align-middle border border-black/30"
      title={`Moral ${v}`}
      style={{ background: v >= 70 ? "#3D8C40" : v >= 45 ? "#A87800" : "#C0182B" }}
    />
  );

  return (
    <div className="space-y-4">
      {/* ── controls bar (seu time) ── */}
      <div className="arc-mini p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1.5">Mentalidade</div>
            <div className="flex gap-1.5">
              {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
                <button key={m} data-sound="confirm" onClick={() => setTactic({ mentality: m })}
                  className={`arc-btn arc-btn--card flex-1 py-1 text-[11px] ${
                    ts.team.tactics.mentality === m
                      ? m === "ofensivo" ? "arc-btn--rosa" : m === "defensivo" ? "arc-btn--ciano" : "arc-btn--lima"
                      : "arc-btn--paper"}`}>
                  {MENTALITY_LABEL[m]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1.5">Estilo de jogo</div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(STYLE_LABEL) as GameStyle[]).map((s) => (
                <button key={s} data-sound="confirm" onClick={() => setTactic({ style: s })}
                  className={`arc-btn px-2.5 py-1 text-[11px] ${ts.team.tactics.style === s ? "" : "arc-btn--paper"}`}>
                  {STYLE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1.5">Formação</div>
          <div className="flex flex-wrap gap-1">
            {FORMATION_IDS.map((f) => (
              <button key={f} data-sound="confirm" onClick={() => setTactic({ formation: f })}
                className={`arc-btn px-2 py-0.5 text-[10px] ${ts.team.tactics.formation === f ? "" : "arc-btn--paper"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── seu time (campo + titulares) · reservas · adversário ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_232px_1fr] items-start">
        {/* SEU TIME */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="arc-tag" style={{ background: "var(--lima)" }}>★ Seu time</span>
            <span className="min-w-0 truncate font-arc text-[10px] font-bold uppercase opacity-55">
              {MENTALITY_LABEL[ts.team.tactics.mentality]} · {STYLE_LABEL[ts.team.tactics.style]}
            </span>
          </div>
          <MiniPitch formation={ts.team.tactics.formation} />
          <div className="space-y-1">
            {ts.team.lineup.map((card, i) => card && (
              <button key={card.player.id} data-sound={ts.subsLeft === 0 ? undefined : "confirm"}
                disabled={ts.subsLeft === 0}
                onClick={() => setSubOut(subOut === card.player.id ? null : card.player.id)}
                className={`w-full flex items-center gap-2 rounded-xl border-[2.5px] px-2.5 py-1.5 text-left transition-colors ${
                  subOut === card.player.id ? "border-[var(--ink)] bg-[var(--amarelo)]"
                  : ts.subsLeft === 0 ? "border-transparent opacity-50 cursor-default"
                  : "border-[rgba(20,21,18,0.22)] hover:border-[var(--ink)]"}`}>
                <span className="w-7 shrink-0 font-arc text-[9px] font-extrabold opacity-55">{POSITION_SHORT[slots[i].pos]}</span>
                <span className="min-w-0 flex-1 truncate font-arc text-[12px] font-extrabold uppercase">{card.player.name}</span>
                <MoraleDot v={morale[card.player.id] ?? 70} />
                <StaminaBar v={Math.round(ts.stamina[card.player.id] ?? 100)} />
                <span className="w-6 text-right font-display text-[var(--ink)]">{effectiveOvr(card, slots[i].pos)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* RESERVAS (do lado) */}
        <div className="arc-mini p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="arc-tag">★ Banco</span>
            <span className="font-arc text-[10px] font-extrabold uppercase">
              <b className="font-display text-base align-middle" style={{ color: ts.subsLeft > 0 ? "var(--lima)" : "#C0182B" }}>{ts.subsLeft}</b>
              <span className="opacity-55"> subs</span>
            </span>
          </div>
          {ts.subsLeft === 0 ? (
            <p className="font-arc text-[11px] font-bold opacity-55 py-2">Sem substituições, mister.</p>
          ) : (
            <>
              <p className="font-arc text-[10px] font-extrabold uppercase tracking-wide opacity-55">
                {subOut ? (outIsGk ? "Quem entra? (goleiro)" : "Quem entra?") : "Toque num titular pra trocar"}
              </p>
              {benchSorted.length === 0 && <p className="font-arc text-[11px] font-bold opacity-55">Banco vazio.</p>}
              {benchSorted.map((card, i) => {
                const active = subOut !== null;
                const suggested = active && i === 0 && (outIsGk ? card.player.positions.includes("GK") : true);
                return (
                  <button key={card.player.id} data-sound={active ? "confirm" : "error"}
                    onClick={() => active && doSub(card.player.id)}
                    className={`w-full flex items-center gap-2 rounded-xl border-[2.5px] px-2.5 py-1.5 text-left transition-all ${
                      !active ? "border-[rgba(20,21,18,0.18)] opacity-60 cursor-default"
                      : suggested ? "border-[var(--ink)] bg-[rgba(154,205,30,0.34)]"
                      : "border-[rgba(20,21,18,0.25)] hover:border-[var(--ink)] hover:translate-x-0.5"}`}>
                    <span className="w-6 shrink-0 text-center font-display text-base text-[var(--ink)]">{card.player.ovr}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-arc text-[11px] font-extrabold uppercase text-[var(--ink)]">{card.player.name}</span>
                      <span className="block font-arc text-[9px] font-bold uppercase opacity-50">{card.player.positions.map((p) => POSITION_SHORT[p]).join(" · ")}</span>
                    </span>
                    {suggested && <span className="shrink-0 font-arc text-[8px] font-extrabold uppercase" style={{ color: "#3D8C40" }}>sugerido</span>}
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ADVERSÁRIO (só leitura) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate arc-tag" style={{ background: "var(--rosa)", color: "#FFF6FB" }}>★ {opp.team.name}</span>
            <span className="shrink-0 font-arc text-[9px] font-bold uppercase opacity-45">só leitura</span>
          </div>
          <MiniPitch formation={opp.team.tactics.formation} />
          <div className="font-arc text-[10px] font-bold uppercase opacity-55">
            {MENTALITY_LABEL[opp.team.tactics.mentality]} · {STYLE_LABEL[opp.team.tactics.style]} · {opp.subsLeft} subs
          </div>
          <div className="space-y-0.5">
            {opp.team.lineup.map((card, i) => card && (
              <div key={card.player.id} className="flex items-center gap-2 rounded-lg px-2 py-1 font-arc text-[11px] font-bold bg-[rgba(20,21,18,0.05)]">
                <span className="w-7 shrink-0 text-[9px] font-extrabold opacity-55">{POSITION_SHORT[oppSlots[i].pos]}</span>
                <span className="min-w-0 flex-1 truncate uppercase">{card.player.name}</span>
                <StaminaBar v={Math.round(opp.stamina[card.player.id] ?? 100)} />
                <span className="w-6 text-right font-display">{effectiveOvr(card, oppSlots[i].pos)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post-match ───────────────────────────────────────────────
const SECTOR_ORDER: Record<string, number> = { GK: 0, DEF: 1, MID: 2, ATT: 3 };

function ResultScreen({ result, state, meta }: {
  result: MatchResult;
  state: LiveMatchState;
  meta: Meta;
}) {
  const router = useRouter();
  const c = useCareer();
  const [detail, setDetail] = useState<{ card: Card; pos: Position | null } | null>(null);
  const [statsOpen, setStatsOpen] = useState(false);
  const [openOther, setOpenOther] = useState<string | null>(null);

  const w = winnerOf(result);
  const userWon = w === meta.userSide;
  const draw = w === "draw";

  // entries in positional order: current XI by slot order, then subs-off by sector
  const teamCards = (side: "h" | "a"): { card: Card; pos: Position | null }[] => {
    const ts = side === "h" ? state.h : state.a;
    const slots = FORMATIONS[ts.team.tactics.formation];
    const onPitch: { card: Card; pos: Position | null }[] = [];
    ts.team.lineup.forEach((card, i) => {
      if (card && result.playerStats[card.player.id]) onPitch.push({ card, pos: slots[i].pos });
    });
    const seen = new Set(onPitch.map((e) => e.card.player.id));
    const rest = ts.roster
      .filter((card) => !seen.has(card.player.id) && result.playerStats[card.player.id])
      .map((card) => ({ card, pos: card.player.positions[0] as Position | null }))
      .sort((a, b) => SECTOR_ORDER[POSITION_SECTOR[a.pos ?? "ST"]] - SECTOR_ORDER[POSITION_SECTOR[b.pos ?? "ST"]]);
    return [...onPitch, ...rest];
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

  // other matches of the same round, clustered by group
  const others = (c.cup?.fixtures ?? []).filter(
    (f) => f.round === meta.round && f.id !== meta.fixture.id && f.scoreH !== null
  );
  const byGroup = new Map<string, Fixture[]>();
  for (const f of others) {
    const k = f.group ? `Grupo ${f.group}` : roundLabel(c.cup!, f.round);
    byGroup.set(k, [...(byGroup.get(k) ?? []), f]);
  }

  const ratingColor = (r: number) =>
    r >= 8 ? "bg-[#3D8C40] text-white"
    : r >= 7 ? "bg-[var(--amarelo)] text-black"
    : r >= 6 ? "bg-[rgba(20,21,18,0.12)] text-[var(--ink)]"
    : "bg-[#C0182B] text-white";

  function RatingList({ side }: { side: "h" | "a" }) {
    const entries = teamCards(side);
    const ts = side === "h" ? state.h : state.a;
    return (
      <div className="arc-panel p-4">
        <h3 className="font-display text-lg mb-2 flex items-center gap-2">
          <span>{ts.team.flag}</span> {ts.team.name}
        </h3>
        <div className="space-y-1">
          {entries.map(({ card, pos }) => {
            const ps = result.playerStats[card.player.id];
            if (!ps) return null;
            return (
              <button
                key={card.player.id}
                data-sound="confirm"
                onClick={() => setDetail({ card, pos })}
                className="w-full flex items-center gap-2 font-arc text-sm font-bold rounded-lg px-2 py-1.5 hover:bg-[var(--surface)] transition-colors text-left"
              >
                <span className="text-[10px] opacity-50 w-8 shrink-0 font-extrabold">{pos ? POSITION_SHORT[pos] : ""}</span>
                <span className={`w-9 text-center rounded-md font-display shrink-0 border border-black/25 ${ratingColor(ps.rating)}`}>
                  {ps.rating.toFixed(1)}
                </span>
                <span className="flex-1 truncate">{card.player.name}</span>
                <span className="shrink-0 flex items-center gap-1">
                  {Array.from({ length: Math.min(4, ps.goals) }).map((_, i) => <IconBall key={`g${i}`} size={13} className="text-[var(--accent)]" />)}
                  {Array.from({ length: Math.min(3, ps.assists) }).map((_, i) => <IconAssist key={`a${i}`} size={13} className="text-[var(--blue)]" />)}
                  {ps.cards > 0 && <IconCard size={13} />}
                  {ps.saves > 2 && <IconGlove size={13} className="text-[var(--blue)]" />}
                  {card.player.id === result.motmId && <IconStar size={13} className="text-[var(--gold)]" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <main className="arc-bg flex-1 w-full safe-x safe-b">
      <SoundProvider />
      <div className="mx-auto max-w-5xl w-full px-4 py-6 space-y-5">
        {/* Final score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="arc-strip !rounded-2xl p-6 text-center relative overflow-hidden"
        >
          <div className="font-arc text-xs font-extrabold uppercase tracking-[0.3em] text-white/60 mb-1">
            Fim de papo · {roundLabel(c.cup!, meta.round)}
          </div>
          <div className="font-arc text-[10px] font-bold text-white/55 mb-2 flex items-center justify-center gap-1.5">
            <IconStadium size={12} /> {meta.stadium} · {meta.attendance.toLocaleString("pt-BR")} presentes
          </div>
          <div className="font-display text-2xl sm:text-4xl flex items-center justify-center gap-4 flex-wrap">
            <span>{state.h.team.flag} {state.h.team.name}</span>
            <span className="text-5xl sm:text-6xl" style={{ color: "var(--amarelo)" }}>{result.scoreH}–{result.scoreA}</span>
            <span>{state.a.team.name} {state.a.team.flag}</span>
          </div>
          {result.pensH != null && (
            <div className="font-arc text-sm font-extrabold mt-1" style={{ color: "var(--amarelo)" }}>
              Pênaltis: {result.pensH}–{result.pensA}
            </div>
          )}
          <div className="mt-3 font-display text-2xl" style={{ color: userWon ? "var(--lima)" : draw ? "var(--amarelo)" : "var(--rosa)" }}>
            {userWon ? "VITÓRIA!" : draw ? "EMPATE" : "DERROTA"}
          </div>
          <button
            data-sound="confirm"
            onClick={() => setStatsOpen(true)}
            className="arc-btn arc-btn--paper px-5 py-1.5 mt-3 text-xs inline-flex items-center gap-2"
          >
            <IconChart size={14} /> Estatísticas do jogo
          </button>
        </motion.div>

        {/* MOTM */}
        {motmEntry && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="arc-panel p-4 flex items-center gap-4 !bg-[var(--amarelo)]"
          >
            <IconStar size={34} className="text-[var(--ink)] shrink-0" />
            <div className="flex-1">
              <div className="font-arc text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--ink)] opacity-70">Craque da partida</div>
              <div className="font-display text-xl text-[var(--ink)]">{motmEntry.card.flag} {motmEntry.card.player.name}</div>
              <div className="font-arc text-xs font-bold text-[var(--ink)] opacity-60">{motmEntry.card.nation} {motmEntry.card.year}</div>
            </div>
            <div className="font-display text-3xl text-[var(--ink)]">
              {result.playerStats[motmEntry.card.player.id]?.rating.toFixed(1)}
            </div>
          </motion.div>
        )}

        {/* Ratings, ordered by position */}
        <div className="grid sm:grid-cols-2 gap-4">
          <RatingList side={meta.userSide} />
          <RatingList side={meta.userSide === "h" ? "a" : "h"} />
        </div>

        {/* Other results, clustered by group */}
        {others.length > 0 && (
          <div className="arc-panel p-4">
            <h3 className="font-display text-lg mb-3">Aconteceu ao mesmo tempo…</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[...byGroup.entries()].map(([label, fs]) => (
                <div key={label} className="arc-mini p-3">
                  <div className="font-arc text-[10px] font-extrabold uppercase tracking-wider mb-1.5" style={{ color: "var(--gold)" }}>{label}</div>
                  {fs.map((f) => (
                    <div key={f.id} className="font-arc text-sm font-bold">
                      <button
                        data-sound="confirm"
                        onClick={() => setOpenOther(openOther === f.id ? null : f.id)}
                        className="w-full flex items-center justify-between gap-2 py-1 hover:bg-[var(--surface)] rounded-lg px-1 transition-colors"
                      >
                        <span className="truncate text-left flex-1">{c.cup!.teams[f.homeId].flag} {c.cup!.teams[f.homeId].name}</span>
                        <span className="font-display shrink-0">{f.scoreH}–{f.scoreA}{f.pensH != null ? ` (${f.pensH}–${f.pensA})` : ""}</span>
                        <span className="truncate text-right flex-1">{c.cup!.teams[f.awayId].name} {c.cup!.teams[f.awayId].flag}</span>
                      </button>
                      <AnimatePresence>
                        {openOther === f.id && f.scorers && f.scorers.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="text-[10px] opacity-60 py-1 px-1 flex flex-wrap gap-x-3 gap-y-0.5">
                              {f.scorers.map((s, i) => (
                                <span key={i} className="flex items-center gap-1">
                                  <IconBall size={10} className="text-[var(--accent)]" /> {s.name} {s.min}&apos;
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          data-sound="confirm"
          onClick={() => { c.clearLastResult(); router.push("/cup"); }}
          className="arc-btn arc-btn--lima arc-btn--card w-full py-4"
        >
          <span className="block text-xl leading-tight">Continuar</span>
          <span className="block font-arc text-[11px] font-bold opacity-75 mt-0.5">a copa não para, mister</span>
        </button>

        {/* match stats modal */}
        <AnimatePresence>
          {statsOpen && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/70 safe-y"
              onClick={() => setStatsOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
                className="arc-panel my-auto p-6 w-full max-w-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="font-display text-xl mb-4 text-center">
                  {state.h.team.flag} {result.scoreH}–{result.scoreA} {state.a.team.flag}
                </h3>
                <StatsBars statsH={result.statsH} statsA={result.statsA} />
                <button data-sound="cancel" onClick={() => setStatsOpen(false)} className="arc-btn arc-btn--paper w-full py-2.5 mt-5 text-sm">Fechar</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player detail modal */}
        <AnimatePresence>
          {detail && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 bg-black/70 safe-y"
              onClick={() => setDetail(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
                className="arc-panel my-auto p-6 w-full max-w-sm"
                onClick={(e) => e.stopPropagation()}
              >
                {(() => {
                  const ps = result.playerStats[detail.card.player.id];
                  return (
                    <>
                      <div className="text-center mb-4">
                        <div className="text-4xl mb-1">{detail.card.flag}</div>
                        <div className="font-display text-2xl">{detail.card.player.name}</div>
                        <div className="font-arc text-xs font-bold opacity-55">
                          {detail.card.nation} {detail.card.year} · OVR {detail.card.player.ovr}
                          {detail.card.player.id === result.motmId ? " · Craque da partida" : ""}
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
                          <div key={label as string} className="arc-mini p-3">
                            <div className="font-display text-xl" style={{ color: "var(--accent)" }}>{v}</div>
                            <div className="font-arc text-[10px] font-extrabold uppercase tracking-wider opacity-55">{label}</div>
                          </div>
                        ))}
                      </div>
                      <button data-sound="cancel" onClick={() => setDetail(null)} className="arc-btn arc-btn--paper w-full py-2.5 mt-4 text-sm">
                        Fechar
                      </button>
                    </>
                  );
                })()}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
