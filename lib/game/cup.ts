// ============================================================
// FUTBATTLE — World Cup, 2026 format:
// 48 teams · 12 groups (A–L) of 4 · top 2 + 8 best thirds → R32
// Rounds: 1–3 groups · 4=R32 · 5=R16 · 6=QF · 7=SF · 8=3º lugar · 9=Final
// ============================================================

import { SQUADS, SQUAD_BY_ID, squadLabel } from "@/lib/data/squads";
import { EDITION_BY_ID, DEFAULT_EDITION_ID } from "@/lib/data/editions";
import type {
  Card, CupState, CupTeamRef, Fixture, FormationId, GroupRow, MatchResult, MatchTeam,
  PlayerTotals, SquadDef,
} from "./types";
import { FORMATION_IDS, assignLineup, effectiveOvr, FORMATIONS } from "./formations";
import { mulberry32, runFullMatch, winnerOf } from "./engine";

export const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];
export const ROUND_LABEL: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "16 avos de final", 5: "Oitavas de final", 6: "Quartas de final",
  7: "Semifinal", 8: "Disputa de 3º lugar", 9: "FINAL",
};
export const LAST_ROUND = 9;

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

// ── Stadiums ─────────────────────────────────────────────────
function editionStadiums(cup: CupState) {
  const ed = EDITION_BY_ID[cup.editionId] ?? EDITION_BY_ID[DEFAULT_EDITION_ID];
  return ed.stadiums;
}

function stadiumFor(cup: CupState, fixtureId: string): string {
  const st = editionStadiums(cup);
  const s = st[hashStr(fixtureId) % st.length];
  return `${s.name} · ${s.city}`;
}

/** Knockout gets the big houses: final at the largest stadium, and so on. */
function koStadium(cup: CupState, round: number, index: number): string {
  const byCap = [...editionStadiums(cup)].sort((a, b) => b.capacity - a.capacity);
  const pick = round === 9 ? byCap[0]
    : round === 8 ? byCap[1 % byCap.length]
    : byCap[(index + round) % byCap.length];
  return `${pick.name} · ${pick.city}`;
}

// ── Draw ─────────────────────────────────────────────────────
export function drawCup(
  user: { name: string; flag: string; colors: [string, string] },
  seed: number,
  editionId: string = DEFAULT_EDITION_ID
): CupState {
  const rand = mulberry32(seed);
  const shuffled = [...SQUADS].sort(() => rand() - 0.5);
  const opponents = shuffled.slice(0, 47);

  const teams: Record<string, CupTeamRef> = {
    USER: { squadId: "USER", name: user.name, flag: user.flag, colors: user.colors },
  };
  for (const s of opponents) {
    teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
  }

  const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
  const groups: Record<string, string[]> = {};
  GROUP_NAMES.forEach((g, i) => { groups[g] = ids.slice(i * 4, i * 4 + 4); });
  const userGroup = GROUP_NAMES.find((g) => groups[g].includes("USER"))!;

  const cup: CupState = {
    teams, groups, fixtures: [], phase: "groups", userGroup, seed,
    editionId, playerTotals: {},
  };

  // Round-robin: r1 (0v1, 2v3) · r2 (0v2, 3v1) · r3 (0v3, 1v2)
  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[0, 3], [1, 2]],
  ];
  for (const g of GROUP_NAMES) {
    pairs.forEach((roundPairs, ri) => {
      roundPairs.forEach(([x, y], pi) => {
        const id = `g${g}-r${ri + 1}-${pi}`;
        cup.fixtures.push({
          id, round: ri + 1, group: g,
          homeId: groups[g][x], awayId: groups[g][y],
          stadium: stadiumFor(cup, id),
          scoreH: null, scoreA: null,
        });
      });
    });
  }

  return cup;
}

// ── Standings ────────────────────────────────────────────────
export function groupTable(cup: CupState, group: string): GroupRow[] {
  const rows: Record<string, GroupRow> = {};
  for (const id of cup.groups[group])
    rows[id] = { teamId: id, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  for (const f of cup.fixtures) {
    if (f.group !== group || f.scoreH === null || f.scoreA === null) continue;
    const h = rows[f.homeId], a = rows[f.awayId];
    h.p++; a.p++;
    h.gf += f.scoreH; h.ga += f.scoreA;
    a.gf += f.scoreA; a.ga += f.scoreH;
    if (f.scoreH > f.scoreA) { h.w++; h.pts += 3; a.l++; }
    else if (f.scoreH < f.scoreA) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(rows).sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || hashStr(x.teamId) - hashStr(y.teamId)
  );
}

/** All 12 third-placed teams, best first (8 advance in the 2026 format). */
export function thirdPlaceTable(cup: CupState): GroupRow[] {
  return GROUP_NAMES.map((g) => groupTable(cup, g)[2]).sort((x, y) =>
    y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || hashStr(x.teamId) - hashStr(y.teamId)
  );
}

/** The 32 teams that reach the knockout (computable once groups finish). */
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
  for (let r = 1; r <= LAST_ROUND; r++) {
    const fs = cup.fixtures.filter((f) => f.round === r);
    if (fs.length > 0 && fs.some((f) => f.scoreH === null)) return r;
  }
  return LAST_ROUND + 1; // done
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
    const res = runFullMatch(home, away, fixtureSeed(cup, f), round >= 4);
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

// ── Knockout construction ────────────────────────────────────
/**
 * R32 bracket (two sides of 8 ties). W = group winner, R = runner-up,
 * T1..T8 = best thirds. Mirrors the 2026 structure: winners face thirds
 * or runners from other groups; remaining runners pair among themselves.
 */
function buildR32(cup: CupState): void {
  const W: Record<string, string> = {}, R: Record<string, string> = {};
  for (const g of GROUP_NAMES) {
    const t = groupTable(cup, g);
    W[g] = t[0].teamId; R[g] = t[1].teamId;
  }
  const thirds = thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId);
  const groupOf = (id: string) => GROUP_NAMES.find((g) => cup.groups[g].includes(id))!;

  // thirds slots by rank: T[0] = best … T[7] = 8th
  // ties layout (left side 0–7, right side 8–15)
  const ties: [string, string][] = [
    [W.A, thirds[7]], [R.E, R.J],
    [W.C, thirds[5]], [W.I, R.A],
    [W.E, thirds[3]], [R.F, R.I],
    [W.G, thirds[1]], [W.K, R.C],
    [W.B, thirds[6]], [R.G, R.L],
    [W.D, thirds[4]], [W.J, R.B],
    [W.F, thirds[2]], [R.H, R.K],
    [W.H, thirds[0]], [W.L, R.D],
  ];

  // Fix-up: a winner can't face a third from its own group
  for (let i = 0; i < ties.length; i++) {
    const [home, away] = ties[i];
    if (groupOf(home) !== groupOf(away)) continue;
    for (let j = 0; j < ties.length; j++) {
      if (i === j) continue;
      const [h2, a2] = ties[j];
      if (!thirds.includes(a2)) continue;
      if (groupOf(home) !== groupOf(a2) && groupOf(h2) !== groupOf(away)) {
        ties[i] = [home, a2]; ties[j] = [h2, away];
        break;
      }
    }
  }

  ties.forEach(([h, a], i) => {
    cup.fixtures.push({
      id: `ko4-${i}`, round: 4, homeId: h, awayId: a,
      stadium: koStadium(cup, 4, i),
      scoreH: null, scoreA: null,
    });
  });
  cup.phase = "r32";
}

/** After group stage completes, build R32. After each KO round, the next. */
export function advanceCup(cup: CupState): void {
  const groupsDone = cup.fixtures
    .filter((f) => f.round <= 3)
    .every((f) => f.scoreH !== null);

  if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
    buildR32(cup);
    return;
  }

  // R16 (5), QF (6), SF (7): winners of the previous round, in bracket order
  for (let round = 5; round <= 7; round++) {
    const prev = cup.fixtures.filter((f) => f.round === round - 1);
    if (prev.length === 0 || prev.some((f) => f.scoreH === null)) continue;
    if (cup.fixtures.some((f) => f.round === round)) continue;
    const winners = prev.map((f) =>
      winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.homeId : f.awayId
    );
    for (let i = 0; i < winners.length; i += 2) {
      cup.fixtures.push({
        id: `ko${round}-${i / 2}`, round,
        homeId: winners[i], awayId: winners[i + 1],
        stadium: koStadium(cup, round, i / 2),
        scoreH: null, scoreA: null,
      });
    }
    cup.phase = round === 5 ? "r16" : round === 6 ? "qf" : "sf";
    return;
  }

  // SFs done → build 3rd-place match (8) and final (9) together
  const sfs = cup.fixtures.filter((f) => f.round === 7);
  if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 9)) {
    const winners = sfs.map((f) =>
      winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.homeId : f.awayId
    );
    const losers = sfs.map((f) =>
      winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId
    );
    cup.fixtures.push({
      id: "ko8-0", round: 8, homeId: losers[0], awayId: losers[1],
      stadium: koStadium(cup, 8, 0), scoreH: null, scoreA: null,
    });
    cup.fixtures.push({
      id: "ko9-0", round: 9, homeId: winners[0], awayId: winners[1],
      stadium: koStadium(cup, 9, 0), scoreH: null, scoreA: null,
    });
    cup.phase = "third";
    return;
  }

  const third = cup.fixtures.find((f) => f.round === 8);
  const final = cup.fixtures.find((f) => f.round === 9);
  if (third && third.scoreH !== null && final && final.scoreH === null) {
    cup.phase = "final";
    return;
  }
  if (final && final.scoreH !== null) {
    const champ = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA }) === "h" ? final.homeId : final.awayId;
    cup.phase = champ === "USER" ? "champion" : "eliminated";
  }

    return r32Qualifiers(cup).includes("USER");
  }
  for (let round = 5; round <= 7; round++) {
    if (cup.fixtures.some((f) => f.round === round)) continue;
    const prev = cup.fixtures.find(
      (f) => f.round === round - 1 && (f.homeId === "USER" || f.awayId === "USER") && f.scoreH !== null
    );
    if (!prev) return false;
    const w = winnerOf({ scoreH: prev.scoreH!, scoreA: prev.scoreA!, pensH: prev.pensH, pensA: prev.pensA });
    return (w === "h" ? prev.homeId : prev.awayId) === "USER";
  }
  // SF played, 3rd/final not built yet → user alive if they played the SF (either match awaits)
  if (!cup.fixtures.some((f) => f.round === 9)) {
    return cup.fixtures.some((f) => f.round === 7 && (f.homeId === "USER" || f.awayId === "USER"));
  }
  return false;
}

/** Final podium (after the cup ends): [campeão, vice, terceiro]. */
export function podium(cup: CupState): [string, string, string] | null {
  const final = cup.fixtures.find((f) => f.round === 9);
  const third = cup.fixtures.find((f) => f.round === 8);
  if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
  const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
  const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
  return [
    fw === "h" ? final.homeId : final.awayId,
    fw === "h" ? final.awayId : final.homeId,
    tw === "h" ? third.homeId : third.awayId,
  ];
}
