// ============================================================
// Motor de mata-mata puro (1934, 1938): 16 seleções, eliminação
// direta. Oitavas → Quartas → Semi → Disputa de 3º → FINAL.
// Sem fase de grupos (cup.groups vazio). Pênaltis no empate fazem
// o papel dos replays históricos.
// ============================================================

import { SQUADS, squadLabel } from "@/lib/data/squads";
import { winnerOf } from "@/lib/game/engine";
import type { CupState, CupTeamRef } from "@/lib/game/types";
import { bigStadium, buildKnockout, pickOpponents } from "./shared";
import { winnersOf } from "./g48";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const LABELS: Record<number, string> = {
  1: "Oitavas de final", 2: "Quartas de final", 3: "Semifinal",
  4: "Disputa de 3º lugar", 5: "FINAL",
};

/** Cria um motor de mata-mata puro de 16 times com a id fornecida. */
export function knockoutEngine(id: string): CupEngine {
  return {
    id,
    teamCount: 16,
    lastRound: 5,
    roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
    build(ctx: DrawContext): DrawResult {
      const rand = ctx.rand;
      const opponents = pickOpponents(SQUADS, rand, 15);
      const teams: Record<string, CupTeamRef> = {
        USER: { squadId: "USER", name: ctx.user.name, flag: ctx.user.flag, colors: ctx.user.colors },
      };
      for (const s of opponents) teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
      const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
      const fixtures = buildKnockout(ctx.editionId, ids, 1, "ko1");
      return { teams, groups: {}, userGroup: "", fixtures };
    },
    advance(cup: CupState) {
      // round r decidido → cria round r+1, até as semis
      for (let r = 1; r <= 2; r++) {
        const cur = cup.fixtures.filter((f) => f.round === r);
        if (cur.length > 0 && cur.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === r + 1)) {
          const w = winnersOf(cur);
          cup.fixtures.push(...buildKnockout(cup.editionId, w, r + 1, `ko${r + 1}`));
          cup.phase = r + 1 === 2 ? "qf" : "sf";
          return;
        }
      }
      // semis completas → 3º lugar + final juntos
      const sfs = cup.fixtures.filter((f) => f.round === 3);
      if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 5)) {
        const w = winnersOf(sfs);
        const losers = sfs.map((f) =>
          winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
        cup.fixtures.push({ id: "ko4-0", round: 4, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
        cup.fixtures.push({ id: "ko5-0", round: 5, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
        cup.phase = "third"; return;
      }
      const third = cup.fixtures.find((f) => f.round === 4);
      const final = cup.fixtures.find((f) => f.round === 5);
      if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
      if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
    },
    champion(cup) {
      const f = cup.fixtures.find((x) => x.round === 5);
      return f && f.scoreH !== null ? winnersOf([f])[0] : null;
    },
    podium(cup) {
      const final = cup.fixtures.find((f) => f.round === 5);
      const third = cup.fixtures.find((f) => f.round === 4);
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
}

export const knockout1934 = knockoutEngine("knockout1934");
export const knockout1938 = knockoutEngine("knockout1938");
