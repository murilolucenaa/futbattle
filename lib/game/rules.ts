// ============================================================
// FUTBATTLE — draft rules
//
// Não há mais teto de craques: o equilíbrio vem do próprio
// sorteio. A roleta é ponderada pela força da seleção — quanto
// mais forte o elenco, mais raro ele é de cair. Pegar um time
// 90+ é sorte; pegar um -80 é azar. Acontece.
//
// O orçamento de giros é curto: 4 giros extras no draft inteiro
// (+1 bônus ao chegar no banco). Trocar a geração da mesma
// seleção (ex.: Brasil 1950 → Brasil 2002) também consome giro.
// ============================================================

import type { SquadDef } from "./types";

export const REROLL_BUDGET = 4;
export const BENCH_REROLL_BONUS = 1;

/** Average OVR of the squad's best 11 — the "power" of the squad. */
export function squadPower(s: SquadDef): number {
  const top = [...s.players].sort((a, b) => b.ovr - a.ovr).slice(0, 11);
  return top.reduce((acc, p) => acc + p.ovr, 0) / top.length;
}

/**
 * Roulette weight: strong squads are rarer. A GOAT-tier squad
 * (power ≥ 92) lands roughly 4× less often than a mid-table one.
 */
export function squadWeight(s: SquadDef): number {
  const p = squadPower(s);
  if (p >= 92) return 0.3;
  if (p >= 89) return 0.55;
  if (p >= 86) return 0.85;
  if (p >= 83) return 1.1;
  return 1.35;
}

/** Weighted random draw from `pool` (already filtered by caller). */
export function drawSquad(pool: SquadDef[], rand: () => number = Math.random): SquadDef | null {
  if (pool.length === 0) return null;
  const total = pool.reduce((acc, s) => acc + squadWeight(s), 0);
  let r = rand() * total;
  for (const s of pool) {
    r -= squadWeight(s);
    if (r <= 0) return s;
  }
  return pool[pool.length - 1];
}
