// ============================================================
// Motor de formato 1930 (Copa inaugural): 13 seleções em 4 grupos
// de tamanhos [4,3,3,3]. O VENCEDOR de cada grupo vai à semifinal
// (2 jogos) → FINAL. Não houve disputa de 3º lugar em 1930 — o
// pódio deriva o 3º do melhor perdedor de semi.
// ============================================================

import { SQUADS, squadLabel } from "@/lib/data/squads";
import { winnerOf } from "@/lib/game/engine";
import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";
import { groupTable } from "@/lib/game/standings";
import { bigStadium, pickOpponents, roundRobin, stadiumByKey } from "./shared";
import { winnersOf } from "./g48";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const GROUPS = ["A", "B", "C", "D"];
const SIZES: Record<string, number> = { A: 4, B: 3, C: 3, D: 3 }; // soma 13
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Semifinal", 5: "FINAL",
};

function groupRoundRobinFixtures(editionId: string, group: string, ids: string[]): Fixture[] {
  const out: Fixture[] = [];
  roundRobin(ids).forEach((pairs, ri) => {
    pairs.forEach(([h, a], pi) => {
      const id = `g${group}-r${ri + 1}-${pi}`;
      out.push({
        id, round: ri + 1, group,
        homeId: h, awayId: a, stadium: stadiumByKey(editionId, id),
        knockout: false, scoreH: null, scoreA: null,
      });
    });
  });
  return out;
}

function loserOf(f: Fixture): string {
  return winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h"
    ? f.awayId : f.homeId;
}

/** 3º lugar (não-oficial em 1930): perdedor de semi que mais marcou; desempate por hash do id. */
function thirdPlace(cup: CupState): string | null {
  const semis = cup.fixtures.filter((f) => f.round === 4);
  if (semis.length < 2 || semis.some((f) => f.scoreH === null)) return null;
  const ranked = semis
    .map((f) => {
      const userHome = winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h";
      const id = loserOf(f);
      const goals = userHome ? f.scoreA! : f.scoreH!; // gols do perdedor
      return { id, goals };
    })
    .sort((a, b) => b.goals - a.goals || (a.id < b.id ? -1 : 1));
  return ranked[0].id;
}

export const groupsSemi1930: CupEngine = {
  id: "groupsSemi1930",
  teamCount: 13,
  lastRound: 5,
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
    // grupos → semis (vencedores cruzados: A×C, B×D)
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const W = Object.fromEntries(GROUPS.map((g) => [g, groupTable(cup, g)[0].teamId]));
      const pairs: [string, string][] = [[W.A, W.C], [W.B, W.D]];
      pairs.forEach(([h, a], i) => cup.fixtures.push({
        id: `ko4-${i}`, round: 4, homeId: h, awayId: a,
        stadium: bigStadium(cup.editionId, i), knockout: true, scoreH: null, scoreA: null,
      }));
      cup.phase = "sf"; return;
    }
    // semis → final (sem disputa de 3º)
    const semis = cup.fixtures.filter((f) => f.round === 4);
    if (semis.length === 2 && semis.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 5)) {
      const w = winnersOf(semis);
      cup.fixtures.push({
        id: "ko5-0", round: 5, homeId: w[0], awayId: w[1],
        stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "final"; return;
    }
    const final = cup.fixtures.find((f) => f.round === 5);
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 5);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 5);
    if (!final || final.scoreH === null) return null;
    const champ = winnersOf([final])[0];
    const vice = loserOf(final);
    const third = thirdPlace(cup) ?? vice;
    return [champ, vice, third];
  },
};
