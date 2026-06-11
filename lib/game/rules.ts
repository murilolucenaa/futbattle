// ============================================================
// FUTBATTLE — draft balancing rules ("anti-apelão")
//
// Sem estas regras o jogador giraria a roleta infinitamente até
// montar um time só de 99. O desafio vem de três limites:
//
//  1. REROLL_BUDGET  — giros extras são um recurso finito do
//     draft inteiro (o 1º giro de cada vaga é grátis).
//  2. CAP_CRACK      — no máximo 1 jogador OVR ≥ 95 no elenco.
//  3. CAP_ELITE      — no máximo 3 jogadores OVR ≥ 90 no elenco
//     (o craque 95+ conta dentro desse teto).
// ============================================================

import type { Card, PlayerDef } from "./types";

export const REROLL_BUDGET = 10;

export const CRACK_OVR = 95;
export const ELITE_OVR = 90;
export const CAP_CRACK = 1;
export const CAP_ELITE = 3;

export interface DraftCheck {
  ok: boolean;
  reason: string | null;
}

export function countCracks(cards: Card[]): number {
  return cards.filter((c) => c.player.ovr >= CRACK_OVR).length;
}

export function countElite(cards: Card[]): number {
  return cards.filter((c) => c.player.ovr >= ELITE_OVR).length;
}

/** Can this player join the squad without breaking the star caps? */
export function canDraft(p: PlayerDef, squad: Card[]): DraftCheck {
  if (p.ovr >= CRACK_OVR && countCracks(squad) >= CAP_CRACK) {
    return { ok: false, reason: `Limite atingido: ${CAP_CRACK} craque (95+) por elenco` };
  }
  if (p.ovr >= ELITE_OVR && countElite(squad) >= CAP_ELITE) {
    return { ok: false, reason: `Limite atingido: ${CAP_ELITE} jogadores de elite (90+)` };
  }
  return { ok: true, reason: null };
}
