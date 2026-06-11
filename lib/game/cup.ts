// ============================================================
// FUTBATTLE — World Cup structure: 8 groups of 4 → knockout
// ============================================================

import { SQUADS, SQUAD_BY_ID, squadLabel } from "@/lib/data/squads";
import type {
  Card, CupState, CupTeamRef, Fixture, FormationId, GroupRow, MatchResult, MatchTeam, SquadDef,
} from "./types";
import { FORMATION_IDS, assignLineup, effectiveOvr, FORMATIONS } from "./formations";
import { mulberry32, runFullMatch, winnerOf } from "./engine";

export const GROUP_NAMES = ["A", "B", "C", "D", "E", "F", "G", "H"];
export const ROUND_LABEL: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Oitavas de final", 5: "Quartas de final", 6: "Semifinal", 7: "FINAL",
};

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
export function drawCup(user: { name: string; flag: string; colors: [string, string] }, seed: number): CupState {
  const rand = mulberry32(seed);
  const shuffled = [...SQUADS].sort(() => rand() - 0.5);
  const opponents = shuffled.slice(0, 31);

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

  // Round-robin: r1 (0v1, 2v3) · r2 (0v2, 3v1) · r3 (0v3, 1v2)
  const fixtures: Fixture[] = [];
  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[0, 3], [1, 2]],
  ];
  for (const g of GROUP_NAMES) {
    pairs.forEach((roundPairs, ri) => {
      roundPairs.forEach(([x, y], pi) => {
        fixtures.push({
          id: `g${g}-r${ri + 1}-${pi}`,
          round: ri + 1, group: g,
          homeId: groups[g][x], awayId: groups[g][y],
          scoreH: null, scoreA: null,
        });
      });
    });
  }

  return { teams, groups, fixtures, phase: "groups", userGroup, seed };
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

// ── Fixture helpers ──────────────────────────────────────────
export function currentRound(cup: CupState): number {
  for (let r = 1; r <= 7; r++) {
    const fs = cup.fixtures.filter((f) => f.round === r);
    if (fs.length > 0 && fs.some((f) => f.scoreH === null)) return r;
  }
  return 8; // done
}

export function userFixture(cup: CupState, round: number): Fixture | null {
  return cup.fixtures.find(
    (f) => f.round === round && f.scoreH === null && (f.homeId === "USER" || f.awayId === "USER")
  ) ?? null;
}

export function fixtureSeed(cup: CupState, f: Fixture): number {
  return (cup.seed ^ hashStr(f.id)) >>> 0;
}

/** Record the user's finished match into the bracket. */
export function recordUserResult(
  cup: CupState,
  fixtureId: string,
  res: MatchResult,
  nameOf: (playerId: string) => string
): void {
  const f = cup.fixtures.find((x) => x.id === fixtureId)!;
  f.scoreH = res.scoreH; f.scoreA = res.scoreA;
  f.pensH = res.pensH; f.pensA = res.pensA;
  f.scorers = res.events
    .filter((e) => e.type === "goal" && e.playerId)
    .map((e) => ({ name: nameOf(e.playerId!), min: e.min, side: e.side }));
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
    f.scorers = res.events
      .filter((e) => e.type === "goal" && e.playerId)
      .map((e) => {
        const team = e.side === "h" ? home : away;
        const all = [...team.lineup.filter(Boolean), ...team.bench] as Card[];
        const card = all.find((c) => c.player.id === e.playerId);
        return { name: card?.player.name ?? "", min: e.min, side: e.side };
      });
  }
}

/** After group stage completes, build R16. After each KO round, build the next. */
export function advanceCup(cup: CupState): void {
  const groupsDone = cup.fixtures
    .filter((f) => f.round <= 3)
    .every((f) => f.scoreH !== null);

  if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
    // Build R16 from group tables: 1A×2B, 1C×2D, 1E×2F, 1G×2H, 1B×2A, 1D×2C, 1F×2E, 1H×2G
    const first: Record<string, string> = {}, second: Record<string, string> = {};
    for (const g of GROUP_NAMES) {
      const t = groupTable(cup, g);
      first[g] = t[0].teamId; second[g] = t[1].teamId;
    }
    const pairings: [string, string][] = [
      [first.A, second.B], [first.C, second.D], [first.E, second.F], [first.G, second.H],
      [first.B, second.A], [first.D, second.C], [first.F, second.E], [first.H, second.G],
    ];
    pairings.forEach(([h, a], i) => {
      cup.fixtures.push({ id: `ko4-${i}`, round: 4, homeId: h, awayId: a, scoreH: null, scoreA: null });
    });
    cup.phase = "r16";
    return;
  }

  for (let round = 5; round <= 7; round++) {
    const prev = cup.fixtures.filter((f) => f.round === round - 1);
    if (prev.length === 0 || prev.some((f) => f.scoreH === null)) continue;
    if (cup.fixtures.some((f) => f.round === round)) continue;
    const winners = prev.map((f) => (winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.homeId : f.awayId));
    for (let i = 0; i < winners.length; i += 2) {
      cup.fixtures.push({
        id: `ko${round}-${i / 2}`, round,
        homeId: winners[i], awayId: winners[i + 1],
        scoreH: null, scoreA: null,
      });
    }
    cup.phase = round === 5 ? "qf" : round === 6 ? "sf" : "final";
    return;
  }

  const final = cup.fixtures.find((f) => f.round === 7);
  if (final && final.scoreH !== null) {
    const champ = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA }) === "h" ? final.homeId : final.awayId;
    cup.phase = champ === "USER" ? "champion" : "eliminated";
  }
}

/** Is the user still alive in the cup? */
export function userAlive(cup: CupState): boolean {
  const round = currentRound(cup);
  if (round <= 3) return true;
  if (round >= 8) return cup.phase === "champion";
  // knockout: user must appear in the current round's fixtures (or they're not built yet)
  const fs = cup.fixtures.filter((f) => f.round === round);
  if (fs.length === 0) {
    // Round not built yet: check user won the previous one
    const prev = cup.fixtures.filter((f) => f.round === round - 1 && (f.homeId === "USER" || f.awayId === "USER"));
    if (round === 4) return groupTable(cup, cup.userGroup).findIndex((r) => r.teamId === "USER") < 2;
    if (prev.length === 0) return false;
    const f = prev[0];
    const w = winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA });
    return (w === "h" ? f.homeId : f.awayId) === "USER";
  }
  return fs.some((f) => f.homeId === "USER" || f.awayId === "USER");
}
