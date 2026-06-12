// ============================================================
// Motor de formato 32 times (1998–2022): 8 grupos de 4 → top2
// (16) → Oitavas → Quartas → Semi → 3º → Final.
// ============================================================

import type { CupState } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/standings";
import { bigStadium } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D","E","F","G","H"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Oitavas de final", 5: "Quartas de final", 6: "Semifinal",
  7: "Disputa de 3º lugar", 8: "FINAL",
};

function r16Qualifiers(cup: CupState): string[] {
  const W: string[] = [], R: string[] = [];
  for (const g of GROUPS) { const t = groupTable(cup, g); W.push(t[0].teamId); R.push(t[1].teamId); }
  // 1A 2B 1C 2D 1E 2F 1G 2H | 1B 2A 1D 2C 1F 2E 1H 2G
  return [
    W[0], R[1], W[2], R[3], W[4], R[5], W[6], R[7],
    W[1], R[0], W[3], R[2], W[5], R[4], W[7], R[6],
  ];
}

export const g32: CupEngine = {
  id: "g32",
  teamCount: 32,
  lastRound: 8,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 32, GROUPS);
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
