"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Pitch from "@/components/Pitch";
import { useCareer, buildUserTeam, USER_COLORS, USER_KIT2 } from "@/lib/game/store";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import { EDITION_BY_ID, DEFAULT_EDITION_ID } from "@/lib/data/editions";
import {
  createMatch, tick, aiMaybeAct, applySub, applyTactics, resultOf, winnerOf, mulberry32,
  type LiveMatchState,
} from "@/lib/game/engine";
import { buildAiTeam, nextUserFixture, fixtureSeed, ROUND_LABEL } from "@/lib/game/cup";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL } from "@/lib/game/tactics";
import { sfxGoal, sfxMove, sfxWhistle } from "@/lib/sfx";
import {
  IconAssist, IconBall, IconCard, IconChart, IconCrowd, IconGlove, IconShirt, IconSnow,
  IconStadium, IconStar, IconSub, IconWeather, IconWhistle,
} from "@/components/icons";
import type {
  Card, Fixture, FormationId, GameStyle, MatchEvent, MatchResult, MatchTeam, Mentality,
  PitchEra, Position, SquadDef, Stadium, WCEdition,
} from "@/lib/game/types";
import { POSITION_SHORT, POSITION_SECTOR } from "@/lib/game/types";

const BASE_TICK_MS = 650;

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
  ballX: number;
  ballY: number;
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
  const [view, setView] = useState<View | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [panel, setPanel] = useState<"feed" | "stats" | "tactics">("feed");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [goalFlash, setGoalFlash] = useState<MatchEvent | null>(null);
  const [cooling, setCooling] = useState(false);
  const recordedRef = useRef(false);

  useEffect(() => setMounted(true), []);

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
    // kit clash: opponent switches to its 2nd kit if needed
    if (colorDist(aiTeam.colors[0], userTeam.colors[0]) < 160) {
      aiTeam = { ...aiTeam, colors: pre.oppSquad.kit2 };
    }
    const home: MatchTeam = pre.userIsHome ? userTeam : aiTeam;
    const away: MatchTeam = pre.userIsHome ? aiTeam : userTeam;
    const coolingBreaks = pre.ed.year >= 2022 || pre.weather === "heat";
    const st = createMatch(home, away, pre.seed, pre.f.round >= 4, coolingBreaks);
    stateRef.current = st;
    metaRef.current = {
      fixture: pre.f, round: pre.f.round,
      userSide: pre.userIsHome ? "h" : "a",
      oppName: aiTeam.name,
      era: pre.ed.era,
      stadium: pre.stadiumStr,
      capacity: pre.stRec.capacity,
      attendance: pre.attendance,
      weather: pre.weather,
      weatherLabel: pre.weatherLabel,
    };
    sfxWhistle();
    setView({ minute: 0, scoreH: 0, scoreA: 0, ballX: 50, ballY: 50, possH: 50, eventCount: 1 });
    setPhase("live");
  }

  // ── Game loop ──
  useEffect(() => {
    if (phase !== "live" || !view || paused || result || cooling) return;
    const st = stateRef.current;
    if (!st || st.finished) return;
    const id = setInterval(() => {
      const s = stateRef.current!;
      const meta = metaRef.current!;
      const evs = tick(s);
      aiMaybeAct(s, meta.userSide === "h" ? "a" : "h");
      const goal = evs.find((e) => e.type === "goal");
      if (goal) {
        sfxGoal();
        setGoalFlash(goal);
        setTimeout(() => setGoalFlash(null), 2100);
      }
      if (evs.some((e) => e.type === "halftime")) sfxWhistle(true);
      if (evs.some((e) => e.type === "fulltime")) sfxWhistle(true);
      if (evs.some((e) => e.type === "cooling")) {
        setCooling(true);
        setTimeout(() => setCooling(false), 1800);
      }
      setView({
        minute: s.minute, scoreH: s.scoreH, scoreA: s.scoreA,
        ballX: s.ballX, ballY: s.ballY,
        possH: s.statsH.possession,
        eventCount: s.events.length,
      });
      if (s.finished) setResult(resultOf(s));
    }, BASE_TICK_MS / speed);
    return () => clearInterval(id);
  }, [phase, view !== null, paused, speed, result, cooling]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Record result into the cup (once) ──
  useEffect(() => {
    if (!result || recordedRef.current) return;
    recordedRef.current = true;
    const meta = metaRef.current!;
    c.recordResult(meta.fixture.id, result, meta.round);
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
    setCooling(false);
    setView({ minute: s.minute, scoreH: s.scoreH, scoreA: s.scoreA, ballX: 50, ballY: 50, possH: s.statsH.possession, eventCount: s.events.length });
    setResult(resultOf(s));
  }

  if (!mounted || !pre) return null;

  if (phase === "pre" && !result) {
    return <PreMatch pre={pre} onKickoff={kickoff} />;
  }

  if (!view || !stateRef.current || !metaRef.current) return null;
  const st = stateRef.current;
  const meta = metaRef.current;

  if (result) {
    return <ResultScreen result={result} state={st} meta={meta} />;
  }

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-3 sm:px-4 py-4 flex flex-col gap-3">
      <Scoreboard st={st} view={view} meta={meta} />
      <PossessionBar st={st} view={view} />
      <LivePitch st={st} view={view} goalFlash={goalFlash} cooling={cooling} speed={speed} meta={meta} />

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
          {([["feed", "Narração"], ["stats", "Estatísticas"], ["tactics", "Tática & Subs"]] as const).map(([k, label]) => (
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
        {panel === "stats" && <StatsBars statsH={st.statsH} statsA={st.statsA} />}
        {panel === "tactics" && <TacticsPanel st={st} meta={meta} morale={c.morale} onChanged={() => setView((v) => v && { ...v })} />}
      </div>
    </main>
  );
}

// ── Pre-match ────────────────────────────────────────────────
function PreMatch({ pre, onKickoff }: { pre: PreInfo; onKickoff: () => void }) {
  const c = useCareer();
  const cup = c.cup!;
  const f = pre.f;
  const userTeam = buildUserTeam(c);
  const oppTeam = useMemo(() => buildAiTeam(pre.oppSquad, f.round), [pre.oppSquad, f.round]);

  // fake odds from average lineup OVR
  const avg = (t: MatchTeam) => {
    const slots = FORMATIONS[t.tactics.formation];
    return t.lineup.reduce((s, card, i) => s + (card ? effectiveOvr(card, slots[i].pos) : 70), 0) / 11;
  };
  const uo = avg(userTeam), oo = avg(oppTeam);
  const pUser = 1 / (1 + Math.pow(10, (oo - uo) / 9));
  const oddUser = Math.max(1.1, +(0.92 / pUser).toFixed(2));
  const oddOpp = Math.max(1.1, +(0.92 / (1 - pUser)).toFixed(2));
  const oddDraw = +(3.1 + Math.abs(uo - oo) * 0.12).toFixed(2);

  const r = mulberry32(pre.seed ^ 0x9e3779b9);
  const punters = ["@torcedor_raiz", "@mister_da_quebrada", "@bola_murcha", "@vidente_da_copa", "@zagueiro_artilheiro"];
  const bets = punters.slice(0, 3).map((p) => ({
    user: p,
    amount: 20 + Math.floor(r() * 480),
    pick: r() < pUser ? cup.teams.USER.name : oppTeam.name,
  }));

  const LineupCol = ({ team, kitColors }: { team: MatchTeam; kitColors: [string, string] }) => {
    const slots = FORMATIONS[team.tactics.formation];
    return (
      <div className="glass p-4 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <IconShirt size={26} fill={kitColors[0]} />
          <div className="min-w-0">
            <div className="font-display text-lg truncate">{team.flag} {team.name}</div>
            <div className="text-[10px] text-[var(--muted)]">{team.tactics.formation} · {MENTALITY_LABEL[team.tactics.mentality]} · {STYLE_LABEL[team.tactics.style]}</div>
          </div>
        </div>
        <div className="space-y-0.5">
          {team.lineup.map((card, i) => card && (
            <div key={card.player.id} className="flex items-center gap-2 text-xs py-0.5">
              <span className="w-8 text-[9px] font-bold text-[var(--muted)]">{POSITION_SHORT[slots[i].pos]}</span>
              <span className="flex-1 truncate font-semibold">{card.player.name}</span>
              <span className="font-display text-[var(--accent)]">{effectiveOvr(card, slots[i].pos)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const oppKit: [string, string] =
    colorDist(oppTeam.colors[0], userTeam.colors[0]) < 160 ? pre.oppSquad.kit2 : oppTeam.colors;

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 space-y-4">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong p-6 text-center relative overflow-hidden">
        <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--gold)] mb-2">
          Pré-jogo · {ROUND_LABEL[f.round]} {f.group ? `· Grupo ${f.group}` : ""}
        </div>
        <div className="font-display text-3xl sm:text-4xl flex items-center justify-center gap-4 flex-wrap mb-3">
          <span className={f.homeId === "USER" ? "text-[var(--accent)]" : ""}>{cup.teams[f.homeId].flag} {cup.teams[f.homeId].name}</span>
          <span className="text-[var(--muted)] text-2xl">x</span>
          <span className={f.awayId === "USER" ? "text-[var(--accent)]" : ""}>{cup.teams[f.awayId].flag} {cup.teams[f.awayId].name}</span>
        </div>
        <div className="flex items-center justify-center gap-5 text-xs text-[var(--muted)] flex-wrap">
          <span className="flex items-center gap-1.5"><IconStadium size={14} /> {pre.stadiumStr}</span>
          <span className="flex items-center gap-1.5"><IconCrowd size={14} /> {pre.attendance.toLocaleString("pt-BR")} torcedores</span>
          <span className="flex items-center gap-1.5"><IconWeather kind={pre.weather} size={14} /> {pre.weatherLabel}</span>
        </div>
      </motion.div>

      <div className="grid sm:grid-cols-2 gap-4">
        <LineupCol team={pre.userIsHome ? userTeam : oppTeam} kitColors={pre.userIsHome ? userTeam.colors : oppKit} />
        <LineupCol team={pre.userIsHome ? oppTeam : userTeam} kitColors={pre.userIsHome ? oppKit : userTeam.colors} />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* kit choice */}
        <div className="glass p-4">
          <h3 className="font-display text-lg mb-2">Seu uniforme</h3>
          <div className="flex gap-3">
            {([['1º uniforme', USER_COLORS, 1], ['2º uniforme', USER_KIT2, 2]] as const).map(([label, colors, k]) => (
              <button
                key={k}
                onClick={() => { sfxMove(); c.setUserKit(k); }}
                className={`flex-1 glass p-3 flex flex-col items-center gap-2 transition-all ${
                  c.userKit === k ? "ring-2 ring-[var(--accent)]" : "hover:bg-[var(--surface-2)]"
                }`}
              >
                <IconShirt size={42} fill={colors[0]} />
                <span className="text-xs font-bold">{label}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[var(--muted)] mt-2">
            O adversário troca para o 2º uniforme se as cores baterem.
          </p>
        </div>

        {/* odds + fake bets */}
        <div className="glass p-4">
          <h3 className="font-display text-lg mb-2">Zebra ou favorito?</h3>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            {[
              [cup.teams.USER.name, oddUser],
              ["Empate", oddDraw],
              [oppTeam.name, oddOpp],
            ].map(([label, odd]) => (
              <div key={label as string} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-2">
                <div className="text-[9px] text-[var(--muted)] truncate">{label}</div>
                <div className="font-display text-xl text-[var(--gold)]">{odd}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {bets.map((b) => (
              <div key={b.user} className="text-[11px] text-[var(--muted)]">
                <span className="text-[var(--blue)] font-semibold">{b.user}</span> apostou {b.amount} moedas em <span className="font-semibold text-white">{b.pick}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button onClick={onKickoff} className="btn-hero w-full py-4 text-lg flex items-center justify-center gap-2">
        <IconWhistle size={20} /> Apito inicial →
      </button>
    </main>
  );
}

// ── Scoreboard ───────────────────────────────────────────────
function Scoreboard({ st, view, meta }: { st: LiveMatchState; view: View; meta: Meta }) {
  return (
    <div className="glass-strong px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 text-right min-w-0 flex items-center justify-end gap-2">
          <span className="font-display text-lg sm:text-2xl truncate">{st.h.team.flag} {st.h.team.name}</span>
          <IconShirt size={20} fill={st.h.team.colors[0]} />
        </div>
        <div className="text-center shrink-0">
          <div className="font-display text-3xl sm:text-4xl tracking-wider">
            {view.scoreH} <span className="text-[var(--muted)]">–</span> {view.scoreA}
          </div>
          <div className="text-[11px] font-bold text-[var(--accent)]">
            {Math.min(90, view.minute)}&apos; · {ROUND_LABEL[meta.round]}
          </div>
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <IconShirt size={20} fill={st.a.team.colors[0]} />
          <span className="font-display text-lg sm:text-2xl truncate">{st.a.team.name} {st.a.team.flag}</span>
        </div>
      </div>
      <div className="text-[9px] text-[var(--muted)] text-center mt-1 flex items-center justify-center gap-3 flex-wrap">
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
      <div className="flex justify-between text-[10px] font-bold mb-0.5">
        <span style={{ color: st.h.team.colors[0] }}>{h}%</span>
        <span className="text-[var(--muted)] uppercase tracking-widest text-[8px]">posse de bola</span>
        <span style={{ color: st.a.team.colors[0] }}>{100 - h}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden flex bg-[var(--surface-2)]">
        <div className="transition-all duration-700" style={{ width: `${h}%`, background: st.h.team.colors[0] }} />
        <div className="flex-1 transition-all duration-700" style={{ background: st.a.team.colors[0] }} />
      </div>
    </div>
  );
}

// ── 2D live pitch ────────────────────────────────────────────
function LivePitch({ st, view, goalFlash, cooling, speed, meta }: {
  st: LiveMatchState; view: View; goalFlash: MatchEvent | null; cooling: boolean; speed: Speed; meta: Meta;
}) {
  const transition = `all ${Math.min(0.65, BASE_TICK_MS / speed / 1000)}s ease-in-out`;
  const secondHalf = view.minute > 45; // teams swap ends at the break
  const mx = (x: number) => (secondHalf ? 100 - x : x);
  const ballShift = (view.ballX - 50) / 50; // -1..1 (engine coords)

  // collect dot positions to find the ball carrier (closest player)
  const dots: { id: string; x: number; y: number; color: string; gk: boolean; name: string }[] = [];
  for (const side of ["h", "a"] as const) {
    const ts = side === "h" ? st.h : st.a;
    const slots = FORMATIONS[ts.team.tactics.formation];
    ts.team.lineup.forEach((card, i) => {
      if (!card) return;
      const s = slots[i];
      const push = side === "h" ? Math.max(0, ballShift) * 14 : Math.max(0, -ballShift) * 14;
      const retreat = side === "h" ? Math.max(0, -ballShift) * 7 : Math.max(0, ballShift) * 7;
      const depth = 3 + s.x * 0.44 + push - retreat;
      const ex = side === "h" ? depth : 100 - depth;
      const ey = side === "h" ? s.y : 100 - s.y;
      dots.push({
        id: card.player.id, x: ex, y: ey,
        color: slots[i].pos === "GK" ? "#FFC53D" : ts.team.colors[0],
        gk: slots[i].pos === "GK",
        name: shortName(card.player.name),
      });
    });
  }
  // ball "carrier": nearest non-GK dot snaps to the ball — contact, not ghost ball
  let carrierId: string | null = null, bestD = Infinity;
  for (const d of dots) {
    if (d.gk) continue;
    const dist = Math.hypot(d.x - view.ballX, d.y - view.ballY);
    if (dist < bestD) { bestD = dist; carrierId = d.id; }
  }
  for (const d of dots) {
    if (d.id === carrierId && bestD < 30) {
      d.x = d.x + (view.ballX - d.x) * 0.75;
      d.y = d.y + (view.ballY - d.y) * 0.75;
    }
  }
  const carrier = dots.find((d) => d.id === carrierId && bestD < 30);
  const ballX = carrier ? carrier.x + 1.6 : view.ballX;
  const ballY = carrier ? carrier.y + 1.2 : view.ballY;
  const goalSideLeft = goalFlash ? (goalFlash.side === "h" ? !secondHalf : secondHalf) === false : false;

  return (
    <div className={goalFlash ? "shake" : ""}>
      {/* stands ring (era-themed, density by attendance) */}
      <CrowdStrip meta={meta} />

      <Pitch horizontal className={`aspect-[16/9] w-full pitch-${meta.era}`}>
        {dots.map((d) => (
          <div
            key={d.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${mx(d.x)}%`, top: `${d.y}%`, transition }}
          >
            <div
              className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border"
              style={{
                background: d.color,
                borderColor: d.id === carrierId && bestD < 30 ? "#fff" : "rgba(0,0,0,0.5)",
                boxShadow: d.id === carrierId && bestD < 30 ? "0 0 8px rgba(255,255,255,0.7)" : "0 1px 4px rgba(0,0,0,0.6)",
              }}
            />
            <span className="text-[7px] sm:text-[8px] font-bold text-white/90 bg-black/50 rounded px-0.5 mt-0.5 whitespace-nowrap">
              {d.name}
            </span>
          </div>
        ))}

        {/* Ball — glued to the carrier */}
        <div
          className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
          style={{ left: `${mx(ballX)}%`, top: `${ballY}%`, transition }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
        </div>

        {/* Cooling break overlay */}
        <AnimatePresence>
          {cooling && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[rgba(10,20,40,0.6)]"
            >
              <IconSnow size={40} className="text-[#9CD2FF] mb-2" />
              <div className="font-display text-2xl text-[#9CD2FF]">COOLING BREAK</div>
              <div className="text-xs text-white/70">hidratação à beira do campo</div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Goal overlay: net ripple + roar */}
        <AnimatePresence>
          {goalFlash && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55"
            >
              {/* net ripple at the goal that conceded */}
              <div
                className="net-ripple absolute top-1/2 -translate-y-1/2 w-24 h-40 rounded-full pointer-events-none"
                style={{
                  [goalSideLeft ? "left" : "right"]: "-2%",
                  background: "radial-gradient(closest-side, rgba(255,255,255,0.55), transparent)",
                  backgroundImage: "repeating-linear-gradient(0deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 7px), repeating-linear-gradient(90deg, rgba(255,255,255,0.25) 0 2px, transparent 2px 7px)",
                } as React.CSSProperties}
              />
              <motion.div
                initial={{ y: 18, scale: 0.8 }}
                animate={{ y: 0, scale: 1 }}
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

function CrowdStrip({ meta }: { meta: Meta }) {
  const density = Math.max(0.35, Math.min(1, meta.attendance / meta.capacity));
  const n = Math.round(64 * density);
  return (
    <div className={`h-6 mb-1 rounded-t-xl overflow-hidden flex items-center justify-center gap-[3px] px-2 stands stands-${meta.era}`}>
      {Array.from({ length: 64 }).map((_, i) => (
        <span
          key={i}
          className="crowd-dot inline-block w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: i < n ? ["#FFC53D", "#00FF87", "#4DA3FF", "#FF4D5E", "#EAF2EC"][i % 5] : "rgba(255,255,255,0.07)",
            animationDelay: `${(i % 12) * 0.2}s`,
            opacity: i < n ? 0.75 : 0.4,
          }}
          aria-hidden
        />
      ))}
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
    case "cooling": return <IconSnow size={14} className={`${cls} text-[#9CD2FF]`} />;
    case "halftime": case "fulltime": case "kickoff": return <IconWhistle size={14} className={`${cls} text-[var(--gold)]`} />;
    case "post": case "miss": case "penalty-miss": return <IconBall size={14} className={`${cls} text-[var(--muted)]`} />;
    case "tactic": return <IconChart size={14} className={`${cls} text-[var(--muted)]`} />;
    default: return <IconBall size={14} className={`${cls} text-[var(--muted)]`} />;
  }
}

function EventFeed({ st, count }: { st: LiveMatchState; count: number }) {
  const events = useMemo(() => [...st.events].reverse(), [count]); // eslint-disable-line react-hooks/exhaustive-deps
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
            <EventIcon type={e.type} />
            <span className={e.type === "goal" ? "font-bold" : ""}>{e.text}</span>
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
    <span className="inline-block w-12 h-1.5 rounded-full bg-[var(--surface-2)] overflow-hidden align-middle">
      <span className="block h-full" style={{ width: `${v}%`, background: v >= 65 ? "var(--accent)" : v >= 45 ? "var(--gold)" : "var(--red)" }} />
    </span>
  );
  const MoraleDot = ({ v }: { v: number }) => (
    <span
      className="inline-block w-2 h-2 rounded-full align-middle"
      title={`Moral ${v}`}
      style={{ background: v >= 70 ? "var(--accent)" : v >= 45 ? "var(--gold)" : "var(--red)" }}
    />
  );

  return (
    <div className="grid lg:grid-cols-2 gap-4 max-h-80 overflow-y-auto pr-1">
      {/* YOUR side */}
      <div className="space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">Seu time</div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">Formação</div>
          <div className="flex flex-wrap gap-1.5">
            {FORMATION_IDS.map((f) => (
              <button key={f} onClick={() => setTactic({ formation: f })}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-display ${ts.team.tactics.formation === f ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
            <button key={m} onClick={() => setTactic({ mentality: m })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ts.team.tactics.mentality === m ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
              {MENTALITY_LABEL[m]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STYLE_LABEL) as GameStyle[]).map((s) => (
            <button key={s} onClick={() => setTactic({ style: s })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${ts.team.tactics.style === s ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"}`}>
              {STYLE_LABEL[s]}
            </button>
          ))}
        </div>

        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)] mb-1.5">
            Substituições restantes: <span className="text-[var(--accent)]">{ts.subsLeft}</span>
          </div>
          {ts.subsLeft === 0 ? (
            <p className="text-sm text-[var(--muted)]">Sem substituições restantes.</p>
          ) : !subOut ? (
            <div className="space-y-1">
              <p className="text-xs text-[var(--muted)] mb-1">Quem sai?</p>
              {ts.team.lineup.map((card, i) => card && (
                <button key={card.player.id} onClick={() => setSubOut(card.player.id)}
                  className="w-full btn-ghost px-3 py-1.5 text-left text-sm flex justify-between items-center gap-2">
                  <span className="truncate">{POSITION_SHORT[slots[i].pos]} · {card.player.name}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <MoraleDot v={morale[card.player.id] ?? 70} />
                    <StaminaBar v={Math.round(ts.stamina[card.player.id] ?? 100)} />
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              <button onClick={() => setSubOut(null)} className="text-xs text-[var(--muted)] hover:text-white mb-1">← cancelar</button>
              <p className="text-xs text-[var(--muted)] mb-1">
                Quem entra?{outIsGk && " Sugestão óbvia: o goleiro reserva."}
              </p>
              {benchSorted.length === 0 && <p className="text-sm text-[var(--muted)]">Banco vazio.</p>}
              {benchSorted.map((card, i) => {
                const suggested = i === 0 && (outIsGk ? card.player.positions.includes("GK") : true);
                return (
                  <button key={card.player.id} onClick={() => doSub(card.player.id)}
                    className={`w-full px-3 py-1.5 text-left text-sm flex justify-between items-center rounded-xl border transition-all ${
                      suggested ? "border-[var(--accent)] bg-[rgba(0,255,135,0.08)]" : "btn-ghost"
                    }`}>
                    <span className="truncate">
                      {card.player.name}
                      {suggested && <span className="text-[9px] text-[var(--accent)] font-bold ml-2 uppercase">sugerido</span>}
                    </span>
                    <span className="font-display text-[var(--accent)] shrink-0">{card.player.ovr}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* OPPONENT side — read only */}
      <div className="space-y-2 lg:border-l lg:border-[var(--border)] lg:pl-4">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">
          {opp.team.flag} {opp.team.name} <span className="text-[9px]">(só observação, mister)</span>
        </div>
        <div className="text-[11px] text-[var(--muted)]">
          {opp.team.tactics.formation} · {MENTALITY_LABEL[opp.team.tactics.mentality]} · {STYLE_LABEL[opp.team.tactics.style]} · subs {opp.subsLeft}
        </div>
        <div className="space-y-0.5">
          {opp.team.lineup.map((card, i) => card && (
            <div key={card.player.id} className="px-2 py-1 text-xs flex justify-between items-center gap-2 rounded-lg bg-[var(--surface)]">
              <span className="truncate">{POSITION_SHORT[oppSlots[i].pos]} · {card.player.name}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-display">{effectiveOvr(card, oppSlots[i].pos)}</span>
                <StaminaBar v={Math.round(opp.stamina[card.player.id] ?? 100)} />
              </span>
            </div>
          ))}
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
    const k = f.group ? `Grupo ${f.group}` : ROUND_LABEL[f.round];
    byGroup.set(k, [...(byGroup.get(k) ?? []), f]);
  }

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
          {entries.map(({ card, pos }) => {
            const ps = result.playerStats[card.player.id];
            if (!ps) return null;
            return (
              <button
                key={card.player.id}
                onClick={() => setDetail({ card, pos })}
                className="w-full flex items-center gap-2 text-sm rounded-lg px-2 py-1.5 hover:bg-[var(--surface)] transition-colors text-left"
              >
                <span className="text-[10px] text-[var(--muted)] w-8 shrink-0 font-bold">{pos ? POSITION_SHORT[pos] : ""}</span>
                <span className={`w-9 text-center rounded-md font-display shrink-0 ${ratingColor(ps.rating)}`}>
                  {ps.rating.toFixed(1)}
                </span>
                <span className="flex-1 truncate font-semibold">{card.player.name}</span>
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
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6 space-y-5">
      {/* Final score */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-strong p-6 text-center relative overflow-hidden"
      >
        <div className={`absolute inset-0 pointer-events-none ${userWon ? "bg-gradient-to-b from-[rgba(0,255,135,0.12)] to-transparent" : draw ? "" : "bg-gradient-to-b from-[rgba(255,77,94,0.10)] to-transparent"}`} />
        <div className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--muted)] mb-1">
          Fim de jogo · {ROUND_LABEL[meta.round]}
        </div>
        <div className="text-[10px] text-[var(--muted)] mb-2 flex items-center justify-center gap-1.5">
          <IconStadium size={12} /> {meta.stadium} · {meta.attendance.toLocaleString("pt-BR")} presentes
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
          {userWon ? "VITÓRIA!" : draw ? "EMPATE" : "DERROTA"}
        </div>
        <button
          onClick={() => setStatsOpen(true)}
          className="btn-ghost px-5 py-2 mt-3 text-sm font-bold inline-flex items-center gap-2"
        >
          <IconChart size={15} /> Estatísticas do jogo
        </button>
      </motion.div>

      {/* MOTM */}
      {motmEntry && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass p-4 flex items-center gap-4 border border-[rgba(255,197,61,0.35)]"
        >
          <IconStar size={34} className="text-[var(--gold)] shrink-0" />
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

      {/* Ratings, ordered by position */}
      <div className="grid sm:grid-cols-2 gap-4">
        <RatingList side={meta.userSide} />
        <RatingList side={meta.userSide === "h" ? "a" : "h"} />
      </div>

      {/* Other results, clustered by group */}
      {others.length > 0 && (
        <div className="glass p-4">
          <h3 className="font-display text-lg mb-3">Aconteceu ao mesmo tempo…</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...byGroup.entries()].map(([label, fs]) => (
              <div key={label} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)] mb-1.5">{label}</div>
                {fs.map((f) => (
                  <div key={f.id} className="text-sm">
                    <button
                      onClick={() => setOpenOther(openOther === f.id ? null : f.id)}
                      className="w-full flex items-center justify-between gap-2 py-1 hover:bg-[var(--surface-2)] rounded-lg px-1 transition-colors"
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
                          <div className="text-[10px] text-[var(--muted)] py-1 px-1 flex flex-wrap gap-x-3 gap-y-0.5">
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
        onClick={() => { c.clearLastResult(); router.push("/cup"); }}
        className="btn-hero w-full py-4 text-lg"
      >
        Continuar →
      </button>

      {/* match stats modal */}
      <AnimatePresence>
        {statsOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setStatsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
              className="glass-strong p-6 w-full max-w-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="font-display text-xl mb-4 text-center">
                {state.h.team.flag} {result.scoreH}–{result.scoreA} {state.a.team.flag}
              </h3>
              <StatsBars statsH={result.statsH} statsA={result.statsA} />
              <button onClick={() => setStatsOpen(false)} className="btn-ghost w-full py-2.5 mt-5 font-bold">Fechar</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
