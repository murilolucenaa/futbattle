// ============================================================
// Motor de formato 48 times (Copa 2026) — também o motor do
// modo Tradicional em qualquer edição. Reproduz o sorteio e o
// chaveamento que antes viviam hardcoded em cup.ts.
// ============================================================

import { SQUADS, squadLabel } from "@/lib/data/squads";
import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable, thirdPlaceTable } from "@/lib/game/cup";
import { bigStadium, pickOpponents, stadiumByKey } from "./shared";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const GROUP_NAMES = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "16 avos de final", 5: "Oitavas de final", 6: "Quartas de final",
  7: "Semifinal", 8: "Disputa de 3º lugar", 9: "FINAL",
};

const GROUP_PAIRS: [number, number][][] = [
  [[0,1],[2,3]], [[0,2],[3,1]], [[0,3],[1,2]],
];

export function buildGroups(ctx: DrawContext, count: number, groupNames: string[]) {
  const rand = ctx.rand;
  const opponents = pickOpponents(SQUADS, rand, count - 1);
  const teams: Record<string, CupTeamRef> = {
    USER: { squadId: "USER", name: ctx.user.name, flag: ctx.user.flag, colors: ctx.user.colors },
  };
  for (const s of opponents) teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
  const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
  const groups: Record<string, string[]> = {};
  const per = count / groupNames.length;
  groupNames.forEach((g, i) => { groups[g] = ids.slice(i * per, i * per + per); });
  const userGroup = groupNames.find((g) => groups[g].includes("USER"))!;
  return { teams, groups, userGroup };
}

export function groupFixtures(editionId: string, groups: Record<string, string[]>, groupNames: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const g of groupNames) {
    GROUP_PAIRS.forEach((roundPairs, ri) => {
      roundPairs.forEach(([x, y], pi) => {
        const id = `g${g}-r${ri + 1}-${pi}`;
        fixtures.push({
          id, round: ri + 1, group: g,
          homeId: groups[g][x], awayId: groups[g][y],
          stadium: stadiumByKey(editionId, id),
          knockout: false, scoreH: null, scoreA: null,
        });
      });
    });
  }
  return fixtures;
}

export function winnersOf(fixtures: Fixture[]): string[] {
  return fixtures.map((f) =>
    winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.homeId : f.awayId);
}

function buildR32(cup: CupState): void {
  const W: Record<string, string> = {}, R: Record<string, string> = {};
  for (const g of GROUP_NAMES) { const t = groupTable(cup, g); W[g] = t[0].teamId; R[g] = t[1].teamId; }
  const thirds = thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId);
  const groupOf = (id: string) => GROUP_NAMES.find((g) => cup.groups[g].includes(id))!;
  const ties: [string, string][] = [
    [W.A, thirds[7]], [R.E, R.J], [W.C, thirds[5]], [W.I, R.A],
    [W.E, thirds[3]], [R.F, R.I], [W.G, thirds[1]], [W.K, R.C],
    [W.B, thirds[6]], [R.G, R.L], [W.D, thirds[4]], [W.J, R.B],
    [W.F, thirds[2]], [R.H, R.K], [W.H, thirds[0]], [W.L, R.D],
  ];
  for (let i = 0; i < ties.length; i++) {
    const [home, away] = ties[i];
    if (groupOf(home) !== groupOf(away)) continue;
    for (let j = 0; j < ties.length; j++) {
      if (i === j) continue;
      const [h2, a2] = ties[j];
      if (!thirds.includes(a2)) continue;
      if (groupOf(home) !== groupOf(a2) && groupOf(h2) !== groupOf(away)) {
        ties[i] = [home, a2]; ties[j] = [h2, away]; break;
      }
    }
  }
  ties.forEach(([h, a], i) => {
    cup.fixtures.push({
      id: `ko4-${i}`, round: 4, homeId: h, awayId: a,
      stadium: bigStadium(cup.editionId, (i + 4) % 16),
      knockout: true, scoreH: null, scoreA: null,
    });
  });
  cup.phase = "r32";
}

export const g48: CupEngine = {
  id: "g48",
  teamCount: 48,
  lastRound: 9,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 48, GROUP_NAMES);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUP_NAMES) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) { buildR32(cup); return; }
    for (let round = 5; round <= 7; round++) {
      const prev = cup.fixtures.filter((f) => f.round === round - 1);
      if (prev.length === 0 || prev.some((f) => f.scoreH === null)) continue;
      if (cup.fixtures.some((f) => f.round === round)) continue;
      const winners = winnersOf(prev);
      for (let i = 0; i < winners.length; i += 2) {
        cup.fixtures.push({
          id: `ko${round}-${i / 2}`, round, homeId: winners[i], awayId: winners[i + 1],
          stadium: bigStadium(cup.editionId, (round + i / 2) % 16),
          knockout: true, scoreH: null, scoreA: null,
        });
      }
      cup.phase = round === 5 ? "r16" : round === 6 ? "qf" : "sf";
      return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 7);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 9)) {
      const winners = winnersOf(sfs);
      const losers = sfs.map((f) =>
        winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko8-0", round: 8, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko9-0", round: 9, homeId: winners[0], awayId: winners[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 8);
    const final = cup.fixtures.find((f) => f.round === 9);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) {
      const champ = winnersOf([final])[0];
      cup.phase = champ === "USER" ? "champion" : "eliminated";
    }
  },
  champion(cup) {
    const final = cup.fixtures.find((f) => f.round === 9);
    if (!final || final.scoreH === null) return null;
    return winnersOf([final])[0];
  },
  podium(cup) {
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
  },
};
