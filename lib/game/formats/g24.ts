// ============================================================
// Motor de formato 24 times (1986–94): 6 grupos de 4 → top2
// (12) + 4 melhores 3ºs = 16 → Oitavas → Quartas → Semi → 3º → Final.
// ============================================================

import type { CupState } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/standings";
import { bigStadium, hashStr } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D","E","F"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Oitavas de final", 5: "Quartas de final", 6: "Semifinal",
  7: "Disputa de 3º lugar", 8: "FINAL",
};

function r16Qualifiers(cup: CupState): string[] {
  const W: string[] = [], R: string[] = [];
  for (const g of GROUPS) { const t = groupTable(cup, g); W.push(t[0].teamId); R.push(t[1].teamId); }
  const thirds = GROUPS.map((g) => groupTable(cup, g)[2])
    .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || hashStr(x.teamId) - hashStr(y.teamId))
    .slice(0, 4).map((r) => r.teamId);
  return [...W, ...R, ...thirds]; // 6 + 6 + 4 = 16
}

export const g24: CupEngine = {
  id: "g24",
  teamCount: 24,
  lastRound: 8,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 24, GROUPS);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUPS) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const q = r16Qualifiers(cup);
      for (let i = 0; i < q.length; i += 2) cup.fixtures.push({
        id: `ko4-${i / 2}`, round: 4, homeId: q[i], awayId: q[i + 1],
        stadium: bigStadium(cup.editionId, (i / 2 + 4) % 12), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "r16"; return;
    }
    for (let round = 5; round <= 6; round++) {
      const prev = cup.fixtures.filter((f) => f.round === round - 1);
      if (prev.length === 0 || prev.some((f) => f.scoreH === null) || cup.fixtures.some((f) => f.round === round)) continue;
      const w = winnersOf(prev);
      for (let i = 0; i < w.length; i += 2) cup.fixtures.push({
        id: `ko${round}-${i / 2}`, round, homeId: w[i], awayId: w[i + 1],
        stadium: bigStadium(cup.editionId, (round + i / 2) % 12), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = round === 5 ? "qf" : "sf"; return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 6);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 8)) {
      const w = winnersOf(sfs);
      const losers = sfs.map((f) => winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko7-0", round: 7, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko8-0", round: 8, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 7);
    const final = cup.fixtures.find((f) => f.round === 8);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 8);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 8);
    const third = cup.fixtures.find((f) => f.round === 7);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [fw === "h" ? final.homeId : final.awayId, fw === "h" ? final.awayId : final.homeId, tw === "h" ? third.homeId : third.awayId];
  },
};
