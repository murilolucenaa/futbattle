// ============================================================
// Motor de formato 1950 (Maracanazo): 13 times em 4 grupos de
// tamanhos [4,4,3,2]. Os 4 primeiros vão ao QUADRANGULAR FINAL
// (round-robin). Campeão = 1º do grupo final. Sem semi/3º/final.
// ============================================================

import { SQUADS, squadLabel } from "@/lib/data/squads";
import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";
import { groupTable } from "@/lib/game/standings";
import { pickOpponents, roundRobin, stadiumByKey } from "./shared";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const GROUPS = ["A", "B", "C", "D"];
const SIZES: Record<string, number> = { A: 4, B: 4, C: 3, D: 2 }; // soma 13
const FINAL_GROUP = "FINAL"; // pseudo-grupo da fase final
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Grupo Final · Rodada 1", 5: "Grupo Final · Rodada 2", 6: "Grupo Final · Rodada 3",
};

function groupRoundRobinFixtures(editionId: string, group: string, ids: string[], roundOffset = 0): Fixture[] {
  const out: Fixture[] = [];
  roundRobin(ids).forEach((pairs, ri) => {
    pairs.forEach(([h, a], pi) => {
      const id = `g${group}-r${ri + 1 + roundOffset}-${pi}`;
      out.push({
        id, round: ri + 1 + roundOffset, group,
        homeId: h, awayId: a, stadium: stadiumByKey(editionId, id),
        knockout: false, scoreH: null, scoreA: null,
      });
    });
  });
  return out;
}

function championOf(cup: CupState): string | null {
  const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
  if (fg.length === 0 || fg.some((f) => f.scoreH === null)) return null;
  return groupTable(cup, FINAL_GROUP)[0].teamId;
}

export const finalGroup1950: CupEngine = {
  id: "finalGroup1950",
  teamCount: 13,
  lastRound: 6,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx: DrawContext): DrawResult {
    const rand = ctx.rand;
    const opponents = pickOpponents(SQUADS, rand, 12);
    const teams: Record<string, CupTeamRef> = {
      USER: { squadId: "USER", name: ctx.user.name, flag: ctx.user.flag, colors: ctx.user.colors },
    };
    for (const s of opponents) teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
    const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
    const groups: Record<string, string[]> = {};
    let cursor = 0;
    for (const g of GROUPS) { groups[g] = ids.slice(cursor, cursor + SIZES[g]); cursor += SIZES[g]; }
    const userGroup = GROUPS.find((g) => groups[g].includes("USER"))!;
    const fixtures = GROUPS.flatMap((g) => groupRoundRobinFixtures(ctx.editionId, g, groups[g]));
    return { teams, groups, userGroup, fixtures };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round >= 4)) {
      const finalists = GROUPS.map((g) => groupTable(cup, g)[0].teamId);
      cup.groups[FINAL_GROUP] = finalists;
      cup.fixtures.push(...groupRoundRobinFixtures(cup.editionId, FINAL_GROUP, finalists, 3));
      cup.phase = "finalGroup";
      return;
    }
    const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
    if (fg.length > 0 && fg.every((f) => f.scoreH !== null)) {
      const champ = championOf(cup);
      cup.phase = champ === "USER" ? "champion" : "eliminated";
    }
  },
  champion: championOf,
  podium(cup) {
    const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
    if (fg.length === 0 || fg.some((f) => f.scoreH === null)) return null;
    const t = groupTable(cup, FINAL_GROUP);
    return [t[0].teamId, t[1].teamId, t[2]?.teamId ?? t[1].teamId];
  },
};
