// ============================================================
// FUTBATTLE — World Cup, 2026 format:
// 48 teams · 12 groups (A–L) of 4 · top 2 + 8 best thirds → R32
// Rounds: 1–3 groups · 4=R32 · 5=R16 · 6=QF · 7=SF · 8=3º lugar · 9=Final
// ============================================================

import { SQUAD_BY_ID, squadLabel } from "@/lib/data/squads";
import { DEFAULT_EDITION_ID } from "@/lib/data/editions";
import type {
  Card, CupMode, CupState, Fixture, FormationId, GroupRow, MatchResult, MatchTeam,
  PlayerTotals, SquadDef,
} from "./types";
import { FORMATION_IDS, assignLineup, effectiveOvr, FORMATIONS } from "./formations";
import { mulberry32, runFullMatch, winnerOf } from "./engine";
import { engineFor } from "./formats/registry";
import { groupTable, thirdPlaceTable } from "./standings";

export const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

/** Rótulo de round delegado ao motor de formato da copa. */
export function roundLabel(cup: CupState, round: number): string {
  return engineFor(cup.mode, cup.editionId).roundLabel(round);
}
/** Último round (round da final / fim do quadrangular) do formato. */
export function lastRound(cup: CupState): number {
  return engineFor(cup.mode, cup.editionId).lastRound;
}

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// ── AI team builder ──────────────────────────────────────────
export function buildAiTeam(squad: SquadDef, variant = 0): MatchTeam {
  const cards: Card[] = squad.players.map((p) => ({
    player: p, squadId: squad.id, nation: squad.nation, year: squad.year, flag: squad.flag,
  }));
  // Pick the formation that maximizes total effective OVR
  let bestF: FormationId = "4-4-2", bestScore = -Infinity, bestLineup: (Card | null)[] = [];
  for (const f of FORMATION_IDS) {
    const lineup = assignLineup(cards, f);
    if (lineup.some((c) => c === null)) continue;
    const score = lineup.reduce((s, c, i) => s + (c ? effectiveOvr(c, FORMATIONS[f][i].pos) : 0), 0);
    if (score > bestScore) { bestScore = score; bestF = f; bestLineup = lineup; }
  }
  if (bestLineup.length === 0) bestLineup = assignLineup(cards, bestF);
  const used = new Set(bestLineup.filter(Boolean).map((c) => c!.player.id));
  const bench = cards.filter((c) => !used.has(c.player.id)).slice(0, 7);
  const mentalities = ["equilibrado", "equilibrado", "ofensivo", "defensivo"] as const;
  const styles = ["posse", "contra-ataque", "laterais", "pressao"] as const;
  const r = mulberry32(hashStr(squad.id) + variant);
  return {
    name: squadLabel(squad),
    flag: squad.flag,
    colors: squad.colors,
    tactics: {
      formation: bestF,
      mentality: mentalities[Math.floor(r() * mentalities.length)],
      style: styles[Math.floor(r() * styles.length)],
    },
    lineup: bestLineup,
    bench,
    isUser: false,
  };
}

// ── Draw ─────────────────────────────────────────────────────
export function drawCup(
  user: { name: string; flag: string; colors: [string, string] },
  seed: number,
  editionId: string = DEFAULT_EDITION_ID,
  mode: CupMode = "tradicional",
): CupState {
  const engine = engineFor(mode, editionId);
  const rand = mulberry32(seed);
  const { teams, groups, userGroup, fixtures } = engine.build({ user, seed, rand, editionId });
  return { teams, groups, fixtures, phase: "groups", userGroup, seed, editionId, mode, playerTotals: {} };
}

// ── Standings (em standings.ts para quebrar ciclo de import) ──
export { groupTable, thirdPlaceTable };

/** The 32 teams that reach the knockout (2026 format). */
export function r32Qualifiers(cup: CupState): string[] {
  const out: string[] = [];
  for (const g of GROUP_NAMES) {
    const t = groupTable(cup, g);
    out.push(t[0].teamId, t[1].teamId);
  }
  out.push(...thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId));
  return out;
}

// ── Fixture helpers ──────────────────────────────────────────
export function currentRound(cup: CupState): number {
  const last = lastRound(cup);
  for (let r = 1; r <= last; r++) {
    const fs = cup.fixtures.filter((f) => f.round === r);
    if (fs.length > 0 && fs.some((f) => f.scoreH === null)) return r;
  }
  return last + 1; // done
}

export function userFixture(cup: CupState, round: number): Fixture | null {
  return cup.fixtures.find(
    (f) => f.round === round && f.scoreH === null && (f.homeId === "USER" || f.awayId === "USER")
  ) ?? null;
}

/** First unplayed fixture involving the user, lowest round first. */
export function nextUserFixture(cup: CupState): Fixture | null {
  return [...cup.fixtures]
    .filter((f) => f.scoreH === null && (f.homeId === "USER" || f.awayId === "USER"))
    .sort((a, b) => a.round - b.round)[0] ?? null;
}

export function fixtureSeed(cup: CupState, f: Fixture): number {
  return (cup.seed ^ hashStr(f.id)) >>> 0;
}

// ── Tournament leaders (artilharia, assistências, notas) ─────
function accumulateTotals(
  cup: CupState,
  res: MatchResult,
  teamIdOf: (playerId: string) => string,
  nameOf: (playerId: string) => string
): void {
  for (const [pid, st] of Object.entries(res.playerStats)) {
    const cur: PlayerTotals = cup.playerTotals[pid] ?? {
      name: nameOf(pid), teamId: teamIdOf(pid),
      goals: 0, assists: 0, ratingSum: 0, matches: 0,
    };
    cur.goals += st.goals;
    cur.assists += st.assists;
    cur.ratingSum += st.rating;
    cur.matches += 1;
    cup.playerTotals[pid] = cur;
  }
}

export type LeaderRow = PlayerTotals & { playerId: string; avgRating: number };

export function leaders(cup: CupState, by: "goals" | "assists" | "rating", n = 10): LeaderRow[] {
  const rows: LeaderRow[] = Object.entries(cup.playerTotals).map(([playerId, t]) => ({
    ...t, playerId, avgRating: t.matches > 0 ? t.ratingSum / t.matches : 0,
  }));
  rows.sort((a, b) =>
    by === "goals" ? b.goals - a.goals || b.assists - a.assists
    : by === "assists" ? b.assists - a.assists || b.goals - a.goals
    : b.avgRating - a.avgRating || b.goals - a.goals
  );
  return rows.filter((r) => (by === "rating" ? r.matches >= 2 : true)).slice(0, n);
}

/** Record the user's finished match into the bracket. */
export function recordUserResult(
  cup: CupState,
  fixtureId: string,
  res: MatchResult,
  nameOf: (playerId: string) => string,
  userPlayerIds: Set<string>
): void {
  const f = cup.fixtures.find((x) => x.id === fixtureId)!;
  f.scoreH = res.scoreH; f.scoreA = res.scoreA;
  f.pensH = res.pensH; f.pensA = res.pensA;
  f.scorers = res.events
    .filter((e) => e.type === "goal" && e.playerId)
    .map((e) => ({ name: nameOf(e.playerId!), min: e.min, side: e.side }));
  const userSide = f.homeId === "USER" ? "USER" : f.awayId === "USER" ? "USER" : null;
  const oppId = f.homeId === "USER" ? f.awayId : f.homeId;
  accumulateTotals(cup, res,
    (pid) => (userPlayerIds.has(pid) && userSide ? "USER" : oppId),
    nameOf);
}

/** Simulate every unplayed AI fixture in `round`. */
export function simulateRound(cup: CupState, round: number, userTeamBuilder?: () => MatchTeam): void {
  for (const f of cup.fixtures) {
    if (f.round !== round || f.scoreH !== null) continue;
    const home = f.homeId === "USER" && userTeamBuilder
      ? userTeamBuilder()
      : buildAiTeam(SQUAD_BY_ID[f.homeId], round);
    const away = f.awayId === "USER" && userTeamBuilder
      ? userTeamBuilder()
      : buildAiTeam(SQUAD_BY_ID[f.awayId], round);
    const res = runFullMatch(home, away, fixtureSeed(cup, f), f.knockout);
    f.scoreH = res.scoreH; f.scoreA = res.scoreA;
    f.pensH = res.pensH; f.pensA = res.pensA;
    const all = [...home.lineup.filter(Boolean), ...home.bench, ...away.lineup.filter(Boolean), ...away.bench] as Card[];
    const cardOf = new Map(all.map((c) => [c.player.id, c]));
    const homeIds = new Set([...home.lineup.filter(Boolean), ...home.bench].map((c) => (c as Card).player.id));
    f.scorers = res.events
      .filter((e) => e.type === "goal" && e.playerId)
      .map((e) => ({ name: cardOf.get(e.playerId!)?.player.name ?? "", min: e.min, side: e.side }));
    accumulateTotals(cup, res,
      (pid) => (homeIds.has(pid) ? f.homeId : f.awayId),
      (pid) => cardOf.get(pid)?.player.name ?? "");
  }
}

// ── Knockout construction (delegada ao motor de formato) ─────
/** After group stage completes, build the next stage via the format engine. */
export function advanceCup(cup: CupState): void {
  engineFor(cup.mode, cup.editionId).advance(cup);
}

/** Is the user still alive (has or will have a match)? */
export function userAlive(cup: CupState): boolean {
  if (cup.phase === "champion") return true;
  if (cup.phase === "eliminated") return false;
  if (nextUserFixture(cup)) return true;
  // sem próximo jogo agendado: simula o avanço numa cópia até surgir um jogo
  // do usuário ou o torneio definir campeão/eliminação
  const probe: CupState = JSON.parse(JSON.stringify(cup));
  let guard = 0;
  while (guard++ < 24) {
    advanceCup(probe);
    if (probe.phase === "champion") return true;
    if (probe.phase === "eliminated") return false;
    if (nextUserFixture(probe)) return true;
    if (!probe.fixtures.some((f) => f.scoreH === null)) return false;
  }
  return false;
}

/** Final podium (after the cup ends): [campeão, vice, terceiro]. */
export function podium(cup: CupState): [string, string, string] | null {
  return engineFor(cup.mode, cup.editionId).podium(cup);
}
