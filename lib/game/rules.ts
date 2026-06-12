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
 * Roulette weight — smooth sigmoid instead of tiers, so two squads with
 * almost the same power have almost the same odds (no cliff at 89→90).
 * A GOAT-tier squad lands roughly 4–5× less often than a mid-table one.
 */
export function squadWeight(s: SquadDef): number {
  const p = squadPower(s);
  return 0.22 + 1.25 / (1 + Math.exp((p - 86.5) / 2.0));
}

/**
 * Bench draw is harsher: the curve's midpoint shifts down ~3 points,
 * so elite squads (and their 90+ stars) rarely show up for reserves.
 */
export function benchSquadWeight(s: SquadDef): number {
  const p = squadPower(s);
  return 0.15 + 1.3 / (1 + Math.exp((p - 83.5) / 1.8));
}

/** Chance that a 90+ star accepts a BENCH call-up ("o olheiro convenceu"). */
export const BENCH_ELITE_UNLOCK_P = 0.2;
export const BENCH_ELITE_OVR = 90;

export interface DrawOpts {
  rand?: () => number;
  mode?: "xi" | "bench";
  excludeId?: string; // avoid landing the same squad twice in a row
}

/** Weighted random draw from `pool` (already filtered by caller). */
export function drawSquad(pool: SquadDef[], opts: DrawOpts = {}): SquadDef | null {
  const rand = opts.rand ?? Math.random;
  const weigh = opts.mode === "bench" ? benchSquadWeight : squadWeight;
  let p = opts.excludeId ? pool.filter((s) => s.id !== opts.excludeId) : pool;
  if (p.length === 0) p = pool;
  if (p.length === 0) return null;
  const total = p.reduce((acc, s) => acc + weigh(s), 0);
  let r = rand() * total;
  for (const s of p) {
    r -= weigh(s);
    if (r <= 0) return s;
  }
  return p[p.length - 1];
}
