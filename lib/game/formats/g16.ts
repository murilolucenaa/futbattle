// ============================================================
// Motor de formato 16 times (1954–70): 4 grupos de 4 → top2
// (8) → Quartas → Semi → 3º → Final. Sem oitavas.
// ============================================================

import type { CupState } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/standings";
import { bigStadium } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Quartas de final", 5: "Semifinal", 6: "Disputa de 3º lugar", 7: "FINAL",
};

// QF clássico: 1A×2B, 1C×2D, 1B×2A, 1D×2C
function qfQualifiers(cup: CupState): string[] {
  const W: Record<string, string> = {}, R: Record<string, string> = {};
  for (const g of GROUPS) { const t = groupTable(cup, g); W[g] = t[0].teamId; R[g] = t[1].teamId; }
  return [W.A, R.B, W.C, R.D, W.B, R.A, W.D, R.C];
}

export const g16: CupEngine = {
  id: "g16",
  teamCount: 16,
  lastRound: 7,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 16, GROUPS);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUPS) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const q = qfQualifiers(cup);
      for (let i = 0; i < q.length; i += 2) cup.fixtures.push({
        id: `ko4-${i / 2}`, round: 4, homeId: q[i], awayId: q[i + 1],
        stadium: bigStadium(cup.editionId, (i / 2 + 2) % 8), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "qf"; return;
    }
    const qf = cup.fixtures.filter((f) => f.round === 4);
    if (qf.length === 4 && qf.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 5)) {
      const w = winnersOf(qf);
      for (let i = 0; i < w.length; i += 2) cup.fixtures.push({
        id: `ko5-${i / 2}`, round: 5, homeId: w[i], awayId: w[i + 1],
        stadium: bigStadium(cup.editionId, (5 + i / 2) % 8), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "sf"; return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 5);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 7)) {
      const w = winnersOf(sfs);
      const losers = sfs.map((f) => winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko6-0", round: 6, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko7-0", round: 7, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 6);
    const final = cup.fixtures.find((f) => f.round === 7);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 7);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 7);
    const third = cup.fixtures.find((f) => f.round === 6);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [fw === "h" ? final.homeId : final.awayId, fw === "h" ? final.awayId : final.homeId, tw === "h" ? third.homeId : third.awayId];
  },
};
