// ============================================================
// FUTBATTLE — live match engine
// Tick = 1 game minute. Deterministic via mulberry32 seed,
// except where live tactic changes alter the stream (by design).
// ============================================================

import type {
  Card, MatchEvent, MatchResult, MatchTeam, PenaltyKick, PenaltyShootout, PlayerMatchStats,
  Position, Tactics, TeamMatchStats,
} from "./types";
import { FORMATIONS, effectiveOvr } from "./formations";
import { tacticMods, type TacticMods } from "./tactics";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Internal team state ──────────────────────────────────────
interface TeamState {
  team: MatchTeam;
  mods: TacticMods;
  stamina: Record<string, number>; // by card id
  subsLeft: number;
  subbedOff: Set<string>;
  roster: Card[]; // every card that can appear in this match
}

export interface LiveMatchState {
  minute: number;
  scoreH: number;
  scoreA: number;
  events: MatchEvent[];
  h: TeamState;
  a: TeamState;
  rand: () => number;
  ballX: number; // 0–100, home attacks toward 100
  ballY: number;
  possMinH: number;
  statsH: TeamMatchStats;
  statsA: TeamMatchStats;
  playerStats: Record<string, PlayerMatchStats>;
  finished: boolean;
  knockout: boolean;
  coolingBreaks: boolean; // 2026-style pauses at 25' and 70'
  pensH?: number;
  pensA?: number;
  penShootout?: PenaltyShootout;
}

const emptyTeamStats = (): TeamMatchStats =>
  ({ possession: 50, shots: 0, onTarget: 0, corners: 0, fouls: 0 });

const emptyPlayerStats = (): PlayerMatchStats =>
  ({ rating: 6.2, goals: 0, assists: 0, shots: 0, saves: 0, cards: 0 });

function fielded(ts: TeamState): { card: Card; pos: Position }[] {
  const slots = FORMATIONS[ts.team.tactics.formation];
  const out: { card: Card; pos: Position }[] = [];
  ts.team.lineup.forEach((c, i) => { if (c) out.push({ card: c, pos: slots[i].pos }); });
  return out;
}

function sectorStrength(ts: TeamState, sector: "GK" | "DEF" | "MID" | "ATT"): number {
  const players = fielded(ts).filter(({ pos }) => {
    if (sector === "GK") return pos === "GK";
    if (sector === "DEF") return ["RB", "CB", "LB"].includes(pos);
    if (sector === "MID") return ["DM", "CM", "AM"].includes(pos);
    return ["RW", "LW", "ST"].includes(pos);
  });
  if (players.length === 0) return 70;
  const sum = players.reduce((acc, { card, pos }) => {
    const stam = ts.stamina[card.player.id] ?? 100;
    return acc + effectiveOvr(card, pos) * (0.6 + 0.4 * (stam / 100));
  }, 0);
  return sum / players.length;
}

// Weighted pick of attacker for goal/assist/shot
function pickAttacker(ts: TeamState, rand: () => number, forGoal: boolean): { card: Card; pos: Position } {
  const m = ts.mods;
  const weights: Partial<Record<Position, number>> = forGoal
    ? { ST: 4.2, RW: 2.6, LW: 2.6, AM: 2.4, CM: 1.1, DM: 0.45, RB: 0.35, LB: 0.35, CB: 0.4 }
    : { AM: 3.4, CM: 2.4, RW: 2.6, LW: 2.6, ST: 1.8, DM: 1.2, RB: 1.0, LB: 1.0, CB: 0.3 };
  const pool = fielded(ts).filter(({ pos }) => pos !== "GK");
  const scored = pool.map((e) => {
    let w = (weights[e.pos] ?? 0.3) * Math.pow(effectiveOvr(e.card, e.pos) / 80, 3);
    if ((e.pos === "RW" || e.pos === "LW") && m.wingWeight > 1) w *= m.wingWeight;
    if (m.falseNine) {
      if (e.pos === "ST") w *= 0.55;
      if (e.pos === "AM" || e.pos === "CM") w *= 1.6;
    }
    return { e, w };
  });
  const total = scored.reduce((s, x) => s + x.w, 0);
  let r = rand() * total;
  for (const x of scored) { r -= x.w; if (r <= 0) return x.e; }
  return scored[scored.length - 1].e;
}

function gk(ts: TeamState): Card | null {
  const slots = FORMATIONS[ts.team.tactics.formation];
  const i = slots.findIndex((s) => s.pos === "GK");
  return ts.team.lineup[i] ?? null;
}

function ps(state: LiveMatchState, id: string): PlayerMatchStats {
  if (!state.playerStats[id]) state.playerStats[id] = emptyPlayerStats();
  return state.playerStats[id];
}

// ── Commentary (pt-BR) ───────────────────────────────────────
const T = {
  goal: [
    "GOOOOOL! {p} balança as redes! Que momento!",
    "É GOL! {p} aparece como um raio e marca!",
    "GOLAÇO DE {P}! A torcida vai ao delírio!",
    "{p} finaliza com categoria. GOL! Não tinha defesa.",
    "Lá dentro! {p} marca e corre pra galera!",
  ],
  assistGoal: [
    "GOOOOOL! {a} acha {p} livre, e ele não perdoa!",
    "Tabela perfeita! {a} serve {p}: GOL!",
    "{a} cruza na medida e {p} completa pro fundo da rede!",
  ],
  save: [
    "{g} faz uma DEFESAÇA no chute de {p}!",
    "Que defesa! {g} voa no canto e espalma o arremate de {p}!",
    "{p} bate forte, mas {g} cresce no lance e salva!",
  ],
  miss: [
    "{p} arrisca de longe — pra fora, assustou!",
    "{p} fica na cara do gol e... ISOLA! Inacreditável!",
    "Passou raspando! {p} quase abre o placar.",
  ],
  post: [
    "NA TRAVE! {p} acerta o poste, o estádio prende a respiração!",
    "Trave! {p} carimba o travessão. Que azar!",
  ],
  card: [
    "Cartão amarelo para {p} depois de uma entrada dura.",
    "{p} chega atrasado e vai pro caderno do árbitro.",
  ],
  chance: [
    "{t} troca passes e pressiona na intermediária.",
    "{t} acelera o jogo pelos flancos!",
    "Pressão de {t}! A defesa afasta com perigo.",
  ],
};

function line(arr: string[], rand: () => number, vars: Record<string, string>): string {
  let s = arr[Math.floor(rand() * arr.length)];
  for (const [k, v] of Object.entries(vars)) {
    s = s.replaceAll(`{${k}}`, v).replaceAll(`{${k.toUpperCase()}}`, v.toUpperCase());
  }
  return s;
}

// ── Setup ────────────────────────────────────────────────────
export function createMatch(
  home: MatchTeam, away: MatchTeam, seed: number, knockout = false, coolingBreaks = false
): LiveMatchState {
  const mkTeam = (t: MatchTeam): TeamState => {
    const roster = [...(t.lineup.filter(Boolean) as Card[]), ...t.bench];
    return {
      team: t,
      mods: tacticMods(t.tactics),
      stamina: Object.fromEntries(roster.map((c) => [c.player.id, 100])),
      subsLeft: 3,
      subbedOff: new Set(),
      roster,
    };
  };
  const state: LiveMatchState = {
    minute: 0, scoreH: 0, scoreA: 0, events: [],
    h: mkTeam(home), a: mkTeam(away),
    rand: mulberry32(seed),
    ballX: 50, ballY: 50, possMinH: 0,
    statsH: emptyTeamStats(), statsA: emptyTeamStats(),
    playerStats: {}, finished: false, knockout, coolingBreaks,
  };
  for (const t of [state.h, state.a])
    for (const { card } of fielded(t)) ps(state, card.player.id);
  state.events.push({
    min: 0, type: "kickoff", side: "h",
    text: `Bola rolando! ${home.name} x ${away.name}`,
    scoreH: 0, scoreA: 0,
  });
  return state;
}

// ── Live controls ────────────────────────────────────────────
export function applyTactics(state: LiveMatchState, side: "h" | "a", tactics: Tactics): void {
  const ts = side === "h" ? state.h : state.a;
  ts.team = { ...ts.team, tactics };
  ts.mods = tacticMods(tactics);
  state.events.push({
    min: state.minute, type: "tactic", side,
    text: `${ts.team.name} ajusta a estratégia.`,
    scoreH: state.scoreH, scoreA: state.scoreA,
  });
}

export function applySub(state: LiveMatchState, side: "h" | "a", outId: string, inId: string): boolean {
  const ts = side === "h" ? state.h : state.a;
  if (ts.subsLeft <= 0) return false;
  const li = ts.team.lineup.findIndex((c) => c?.player.id === outId);
  const bi = ts.team.bench.findIndex((c) => c.player.id === inId);
  if (li < 0 || bi < 0) return false;
  const out = ts.team.lineup[li]!;
  const inc = ts.team.bench[bi];
  const lineup = [...ts.team.lineup]; lineup[li] = inc;
  const bench = ts.team.bench.filter((_, i) => i !== bi);
  ts.team = { ...ts.team, lineup, bench };
  ts.subsLeft--;
  ts.subbedOff.add(outId);
  ts.stamina[inc.player.id] = 100;
  ps(state, inc.player.id);
  state.events.push({
    min: state.minute, type: "sub", side,
    text: `${ts.team.name}: sai ${out.player.name}, entra ${inc.player.name}.`,
    scoreH: state.scoreH, scoreA: state.scoreA,
  });
  return true;
}

export function swapPositions(state: LiveMatchState, side: "h" | "a", idxA: number, idxB: number): void {
  const ts = side === "h" ? state.h : state.a;
  const lineup = [...ts.team.lineup];
  [lineup[idxA], lineup[idxB]] = [lineup[idxB], lineup[idxA]];
  ts.team = { ...ts.team, lineup };
}

// ── Tick: one game minute ────────────────────────────────────
export function tick(state: LiveMatchState): MatchEvent[] {
  if (state.finished) return [];
  state.minute++;
  const { rand } = state;
  const min = state.minute;
  const newEvents: MatchEvent[] = [];
  const push = (e: MatchEvent) => { state.events.push(e); newEvents.push(e); };

  // Stamina decay
  for (const ts of [state.h, state.a]) {
    const drain = (min > 60 ? 0.55 : 0.35) * ts.mods.staminaDrain;
    for (const { card } of fielded(ts))
      ts.stamina[card.player.id] = Math.max(40, (ts.stamina[card.player.id] ?? 100) - drain);
  }

  // Midfield duel → possession this minute
  const midH = sectorStrength(state.h, "MID");
  const midA = sectorStrength(state.a, "MID");
  let possH = midH / (midH + midA);
  possH += (state.h.mods.possession - state.a.mods.possession) / 100;
  possH = Math.min(0.72, Math.max(0.28, possH));
  const homeBall = rand() < possH;
  if (homeBall) state.possMinH++;
  state.statsH.possession = Math.round((state.possMinH / min) * 100);
  state.statsA.possession = 100 - state.statsH.possession;

  const att = homeBall ? state.h : state.a;
  const def = homeBall ? state.a : state.h;
  const side: "h" | "a" = homeBall ? "h" : "a";
  const attStats = homeBall ? state.statsH : state.statsA;

  // Ball drift (for the 2D view): attacker pushes toward opponent goal
  const attStr = sectorStrength(att, "ATT") * att.mods.att;
  const defStr = sectorStrength(def, "DEF") * def.mods.def;
  const push01 = Math.min(1.6, attStr / defStr);
  const targetX = homeBall ? 50 + 38 * push01 * rand() : 50 - 38 * push01 * rand();
  state.ballX += (targetX - state.ballX) * 0.55;
  state.ballY += (rand() * 100 - state.ballY) * 0.35;

  // Chance creation
  const SHOT_BASE = 0.16;
  let chanceP = SHOT_BASE * att.mods.shotRate * Math.sqrt(attStr / Math.max(defStr, 1));
  // counter-attack bonus when ceding possession
  const attPossPct = side === "h" ? state.statsH.possession : state.statsA.possession;
  if (att.mods.counter > 0 && attPossPct < 46) chanceP *= 1 + att.mods.counter;

  // Game management: a side already comfortable kills the clock instead of
  // hunting more goals; the side behind throws bodies forward. Kills 7x0s.
  const lead = homeBall ? state.scoreH - state.scoreA : state.scoreA - state.scoreH;
  if (lead >= 4) chanceP *= 0.35;
  else if (lead >= 3) chanceP *= 0.5;
  else if (lead >= 2) chanceP *= 0.72;
  else if (lead <= -1) chanceP *= 1.12;

  if (rand() < chanceP) {
    const shooter = pickAttacker(att, rand, true);
    const keeper = gk(def);
    const shooterStats = ps(state, shooter.card.player.id);
    shooterStats.shots++;
    attStats.shots++;
    state.ballX = homeBall ? 88 + rand() * 8 : 12 - rand() * 8 + 0;
    state.ballY = 30 + rand() * 40;

    const quality = rand();
    if (quality < 0.30) {
      // Off target / blocked
      if (rand() < 0.5) {
        push({ min, type: "miss", side, text: line(T.miss, rand, { p: shooter.card.player.name }), playerId: shooter.card.player.id, scoreH: state.scoreH, scoreA: state.scoreA });
      }
      if (rand() < 0.35) attStats.corners++;
      shooterStats.rating += 0.02;
    } else if (quality < 0.40 && rand() < 0.5) {
      // Woodwork
      push({ min, type: "post", side, text: line(T.post, rand, { p: shooter.card.player.name }), playerId: shooter.card.player.id, scoreH: state.scoreH, scoreA: state.scoreA });
      shooterStats.rating += 0.12;
    } else {
      // On target
      attStats.onTarget++;
      const gkOvr = keeper ? effectiveOvr(keeper, "GK") : 70;
      const finish = effectiveOvr(shooter.card, shooter.pos);
      let goalP = 0.28 * Math.pow(finish / gkOvr, 2.2);
      if (att.mods.counter > 0 && attPossPct < 46) goalP *= 1.15;
      if (lead >= 3) goalP *= 0.8; // already cruising, less clinical
      goalP = Math.min(0.58, goalP);

      if (rand() < goalP) {
        if (homeBall) state.scoreH++; else state.scoreA++;
        shooterStats.goals++;
        shooterStats.rating += 1.05;
        let text: string;
        if (rand() < 0.6) {
          const assister = pickAttacker(att, rand, false);
          if (assister.card.player.id !== shooter.card.player.id) {
            const as = ps(state, assister.card.player.id);
            as.assists++; as.rating += 0.55;
            text = line(T.assistGoal, rand, { a: assister.card.player.name, p: shooter.card.player.name });
          } else {
            text = line(T.goal, rand, { p: shooter.card.player.name });
          }
        } else {
          text = line(T.goal, rand, { p: shooter.card.player.name });
        }
        if (keeper) ps(state, keeper.player.id).rating -= 0.18;
        push({ min, type: "goal", side, text, playerId: shooter.card.player.id, scoreH: state.scoreH, scoreA: state.scoreA });
        state.ballX = 50; state.ballY = 50;
      } else {
        if (keeper) {
          const kst = ps(state, keeper.player.id);
          kst.saves++; kst.rating += 0.32;
          push({ min, type: "save", side, text: line(T.save, rand, { g: keeper.player.name, p: shooter.card.player.name }), playerId: keeper.player.id, scoreH: state.scoreH, scoreA: state.scoreA });
        }
        if (rand() < 0.4) attStats.corners++;
        shooterStats.rating += 0.08;
      }
    }
  } else if (rand() < 0.05) {
    // Flavor: build-up pressure
    push({ min, type: "chance", side, text: line(T.chance, rand, { t: att.team.name }), scoreH: state.scoreH, scoreA: state.scoreA });
  }

  // Fouls & cards
  const foulP = 0.16 * (def.mods.staminaDrain > 1 ? 1.3 : 1);
  if (rand() < foulP) {
    const defStats = side === "h" ? state.statsA : state.statsH;
    defStats.fouls++;
    if (rand() < 0.09) {
      const offender = pickAttacker(def, rand, false);
      const ost = ps(state, offender.card.player.id);
      ost.cards++; ost.rating -= 0.25;
      push({ min, type: "card", side: side === "h" ? "a" : "h", text: line(T.card, rand, { p: offender.card.player.name }), playerId: offender.card.player.id, scoreH: state.scoreH, scoreA: state.scoreA });
    }
  }

  // Small rating drift for active players
  for (const ts of [state.h, state.a])
    for (const { card } of fielded(ts))
      ps(state, card.player.id).rating += (rand() - 0.48) * 0.015;

  if (state.coolingBreaks && (min === 25 || min === 70)) {
    push({ min, type: "cooling", side: "h", text: "Cooling break — os jogadores se hidratam à beira do gramado.", scoreH: state.scoreH, scoreA: state.scoreA });
  }

  if (min === 45) {
    push({ min, type: "halftime", side: "h", text: `Intervalo: ${state.h.team.name} ${state.scoreH}–${state.scoreA} ${state.a.team.name}`, scoreH: state.scoreH, scoreA: state.scoreA });
  }

  if (min >= 90) {
    state.finished = true;
    if (state.knockout && state.scoreH === state.scoreA) {
      simulatePenalties(state);
    }
    push({ min: 90, type: "fulltime", side: "h", text: `Fim de jogo! ${state.h.team.name} ${state.scoreH}–${state.scoreA} ${state.a.team.name}${state.pensH != null ? ` (${state.pensH}–${state.pensA} nos pênaltis)` : ""}`, scoreH: state.scoreH, scoreA: state.scoreA });
  }
  return newEvents;
}

// ── Penalties (knockout draws) ───────────────────────────────
// Records the kick-by-kick sequence (best-of-5 with early stop + sudden death)
// so the presentation layer can replay it as an animated shootout. RNG draws
// happen one per kick, in order, so the result stays deterministic per seed.
function simulatePenalties(state: LiveMatchState): void {
  const { rand } = state;
  const takers = (ts: TeamState) =>
    fielded(ts).filter((e) => e.pos !== "GK")
      .sort((x, y) => effectiveOvr(y.card, y.pos) - effectiveOvr(x.card, x.pos));
  const hTakers = takers(state.h);
  const aTakers = takers(state.a);
  const hGk = gk(state.a); // keeper facing home shooters
  const aGk = gk(state.h);

  const kicks: PenaltyKick[] = [];
  let ph = 0, pa = 0;
  const shoot = (taker: { card: Card }, keeper: Card | null): boolean => {
    const conv = 0.76 + (taker.card.player.ovr - (keeper?.player.ovr ?? 80)) * 0.004;
    return rand() < Math.min(0.95, Math.max(0.45, conv));
  };
  const take = (side: "h" | "a"): void => {
    const list = side === "h" ? hTakers : aTakers;
    const taker = list[kicks.filter((k) => k.side === side).length % list.length];
    const scored = shoot(taker, side === "h" ? hGk : aGk);
    if (scored) { if (side === "h") ph++; else pa++; }
    kicks.push({ side, shooterId: taker.card.player.id, shooterName: taker.card.player.name, scored });
  };
  // can the trailing side still catch up given kicks left this side?
  const decided = (remH: number, remA: number): boolean => ph > pa + remA || pa > ph + remH;

  let round = 0;
  for (; round < 5; round++) {
    take("h");
    if (decided(4 - round, 5 - round)) break; // a hasn't kicked this round yet
    take("a");
    if (decided(4 - round, 4 - round)) break;
  }
  // sudden death: one each per round until they differ
  let i = 5;
  while (ph === pa && i < 30) {
    take("h");
    take("a");
    i++;
  }
  if (ph === pa) { ph++; } // hard guarantee (never reached in practice)

  state.pensH = ph; state.pensA = pa;
  state.penShootout = { kicks, h: ph, a: pa };
  state.events.push({
    min: 90, type: ph > pa ? "penalty-goal" : "penalty-miss", side: ph > pa ? "h" : "a",
    text: `Disputa de pênaltis: ${state.h.team.name} ${ph}–${pa} ${state.a.team.name}`,
    scoreH: state.scoreH, scoreA: state.scoreA,
  });
}

// ── AI in-match behavior (subs for CPU sides) ────────────────
export function aiMaybeAct(state: LiveMatchState, side: "h" | "a"): void {
  const ts = side === "h" ? state.h : state.a;
  if (ts.team.isUser || ts.subsLeft === 0) return;
  const min = state.minute;
  if (min !== 60 && min !== 72 && min !== 80) return;
  // Sub the most tired non-GK starter for the best same-position bench option
  const slots = FORMATIONS[ts.team.tactics.formation];
  let worstIdx = -1, worstStam = 75;
  ts.team.lineup.forEach((c, i) => {
    if (!c || slots[i].pos === "GK") return;
    const st = ts.stamina[c.player.id] ?? 100;
    if (st < worstStam) { worstStam = st; worstIdx = i; }
  });
  if (worstIdx < 0) return;
  const pos = slots[worstIdx].pos;
  const candidates = [...ts.team.bench].sort((x, y) => effectiveOvr(y, pos) - effectiveOvr(x, pos));
  if (candidates.length === 0) return;
  applySub(state, side, ts.team.lineup[worstIdx]!.player.id, candidates[0].player.id);
  // Losing late → go offensive
  const diff = side === "h" ? state.scoreH - state.scoreA : state.scoreA - state.scoreH;
  if (min >= 72 && diff < 0 && ts.team.tactics.mentality !== "ofensivo") {
    applyTactics(state, side, { ...ts.team.tactics, mentality: "ofensivo" });
  }
  if (min >= 72 && diff > 0 && ts.team.tactics.mentality !== "defensivo") {
    applyTactics(state, side, { ...ts.team.tactics, mentality: "defensivo" });
  }
}

// ── Headless full match (AI vs AI / skip) ────────────────────
export function finishMatch(state: LiveMatchState): MatchResult {
  while (!state.finished) {
    tick(state);
    aiMaybeAct(state, "h");
    aiMaybeAct(state, "a");
  }
  return resultOf(state);
}

export function runFullMatch(home: MatchTeam, away: MatchTeam, seed: number, knockout = false): MatchResult {
  return finishMatch(createMatch(home, away, seed, knockout));
}

export function resultOf(state: LiveMatchState): MatchResult {
  // Clamp ratings & find MOTM
  let motmId: string | null = null;
  let best = -1;
  for (const [id, st] of Object.entries(state.playerStats)) {
    st.rating = Math.min(10, Math.max(4.5, st.rating));
    if (st.rating > best) { best = st.rating; motmId = id; }
  }
  return {
    scoreH: state.scoreH, scoreA: state.scoreA,
    pensH: state.pensH, pensA: state.pensA,
    penShootout: state.penShootout,
    events: state.events,
    statsH: state.statsH, statsA: state.statsA,
    playerStats: state.playerStats,
    motmId,
  };
}

/** Winner of a finished state ("h"/"a"), considering penalties. */
export function winnerOf(state: { scoreH: number; scoreA: number; pensH?: number; pensA?: number }): "h" | "a" | "draw" {
  if (state.scoreH !== state.scoreA) return state.scoreH > state.scoreA ? "h" : "a";
  if (state.pensH != null && state.pensA != null) return state.pensH > state.pensA ? "h" : "a";
  return "draw";
}
