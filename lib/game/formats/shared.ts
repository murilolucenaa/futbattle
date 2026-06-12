// ============================================================
// Helpers compartilhados entre os motores de formato.
// ============================================================

import { EDITION_BY_ID, DEFAULT_EDITION_ID } from "@/lib/data/editions";
import type { Fixture, SquadDef } from "@/lib/game/types";

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Round-robin via círculo. Suporta tamanho ímpar (bye). Cada rodada = lista de pares. */
export function roundRobin(ids: string[]): [string, string][][] {
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push("__BYE__");
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotaciona, fixando arr[0]
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/** n adversários distintos do pool, embaralhados deterministicamente. */
export function pickOpponents(pool: SquadDef[], rand: () => number, n: number): SquadDef[] {
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function editionStadiums(editionId: string) {
  return (EDITION_BY_ID[editionId] ?? EDITION_BY_ID[DEFAULT_EDITION_ID]).stadiums;
}

/** Estádio determinístico por chave (jogos de grupo). */
export function stadiumByKey(editionId: string, key: string): string {
  const st = editionStadiums(editionId);
  const s = st[hashStr(key) % st.length];
  return `${s.name} · ${s.city}`;
}

/** Estádios grandes para o mata-mata (rank 0 = maior). */
export function bigStadium(editionId: string, rank: number): string {
  const byCap = [...editionStadiums(editionId)].sort((a, b) => b.capacity - a.capacity);
  const s = byCap[rank % byCap.length];
  return `${s.name} · ${s.city}`;
}

/** Cria fixtures de mata-mata pareando em ordem de chave. */
export function buildKnockout(
  editionId: string, qualifiers: string[], round: number, idPrefix: string,
  bigStadiumRankBase = 0
): Fixture[] {
  const out: Fixture[] = [];
  for (let i = 0; i < qualifiers.length; i += 2) {
    out.push({
      id: `${idPrefix}-${i / 2}`, round,
      homeId: qualifiers[i], awayId: qualifiers[i + 1],
      stadium: bigStadium(editionId, bigStadiumRankBase + i / 2),
      knockout: true, scoreH: null, scoreA: null,
    });
  }
  return out;
}
