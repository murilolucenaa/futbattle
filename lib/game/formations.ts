import type { Card, FormationId, FormationSlot, Position } from "./types";

// x: 0 = own goal line → 100 = opponent goal line
// y: 0 = left touchline → 100 = right touchline
export const FORMATIONS: Record<FormationId, FormationSlot[]> = {
  "4-3-3": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 38, y: 50 },
    { pos: "CM", x: 50, y: 68 },
    { pos: "CM", x: 50, y: 32 },
    { pos: "RW", x: 72, y: 82 },
    { pos: "ST", x: 82, y: 50 },
    { pos: "LW", x: 72, y: 18 },
  ],
  "4-4-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "RW", x: 50, y: 84 },
    { pos: "CM", x: 44, y: 60 },
    { pos: "CM", x: 44, y: 40 },
    { pos: "LW", x: 50, y: 16 },
    { pos: "ST", x: 78, y: 60 },
    { pos: "ST", x: 78, y: 40 },
  ],
  "4-2-3-1": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 38, y: 60 },
    { pos: "DM", x: 38, y: 40 },
    { pos: "RW", x: 62, y: 82 },
    { pos: "AM", x: 60, y: 50 },
    { pos: "LW", x: 62, y: 18 },
    { pos: "ST", x: 82, y: 50 },
  ],
  "4-3-1-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 36, y: 50 },
    { pos: "CM", x: 48, y: 68 },
    { pos: "CM", x: 48, y: 32 },
    { pos: "AM", x: 62, y: 50 },
    { pos: "ST", x: 80, y: 60 },
    { pos: "ST", x: 80, y: 40 },
  ],
  "3-5-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "CB", x: 18, y: 72 },
    { pos: "CB", x: 15, y: 50 },
    { pos: "CB", x: 18, y: 28 },
    { pos: "RB", x: 42, y: 88 },
    { pos: "DM", x: 36, y: 50 },
    { pos: "CM", x: 50, y: 64 },
    { pos: "CM", x: 50, y: 36 },
    { pos: "LB", x: 42, y: 12 },
    { pos: "ST", x: 80, y: 60 },
    { pos: "ST", x: 80, y: 40 },
  ],
  "3-4-3": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "CB", x: 18, y: 72 },
    { pos: "CB", x: 15, y: 50 },
    { pos: "CB", x: 18, y: 28 },
    { pos: "RB", x: 42, y: 88 },
    { pos: "CM", x: 44, y: 62 },
    { pos: "CM", x: 44, y: 38 },
    { pos: "LB", x: 42, y: 12 },
    { pos: "RW", x: 72, y: 80 },
    { pos: "ST", x: 82, y: 50 },
    { pos: "LW", x: 72, y: 20 },
  ],
  "5-4-1": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 26, y: 88 },
    { pos: "CB", x: 16, y: 70 },
    { pos: "CB", x: 13, y: 50 },
    { pos: "CB", x: 16, y: 30 },
    { pos: "LB", x: 26, y: 12 },
    { pos: "RW", x: 48, y: 80 },
    { pos: "CM", x: 40, y: 60 },
    { pos: "CM", x: 40, y: 40 },
    { pos: "LW", x: 48, y: 20 },
    { pos: "ST", x: 76, y: 50 },
  ],
  "4-1-2-1-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 34, y: 50 },
    { pos: "CM", x: 48, y: 70 },
    { pos: "CM", x: 48, y: 30 },
    { pos: "AM", x: 62, y: 50 },
    { pos: "ST", x: 80, y: 62 },
    { pos: "ST", x: 80, y: 38 },
  ],
  "4-5-1": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "RW", x: 50, y: 86 },
    { pos: "CM", x: 46, y: 66 },
    { pos: "DM", x: 38, y: 50 },
    { pos: "CM", x: 46, y: 34 },
    { pos: "LW", x: 50, y: 14 },
    { pos: "ST", x: 78, y: 50 },
  ],
  "4-2-2-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 36, y: 60 },
    { pos: "DM", x: 36, y: 40 },
    { pos: "AM", x: 58, y: 70 },
    { pos: "AM", x: 58, y: 30 },
    { pos: "ST", x: 80, y: 60 },
    { pos: "ST", x: 80, y: 40 },
  ],
  "5-3-2": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 28, y: 88 },
    { pos: "CB", x: 16, y: 70 },
    { pos: "CB", x: 13, y: 50 },
    { pos: "CB", x: 16, y: 30 },
    { pos: "LB", x: 28, y: 12 },
    { pos: "CM", x: 46, y: 68 },
    { pos: "DM", x: 38, y: 50 },
    { pos: "CM", x: 46, y: 32 },
    { pos: "ST", x: 78, y: 60 },
    { pos: "ST", x: 78, y: 40 },
  ],
  "4-1-4-1": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "RB", x: 24, y: 84 },
    { pos: "CB", x: 18, y: 62 },
    { pos: "CB", x: 18, y: 38 },
    { pos: "LB", x: 24, y: 16 },
    { pos: "DM", x: 34, y: 50 },
    { pos: "RW", x: 54, y: 84 },
    { pos: "CM", x: 50, y: 62 },
    { pos: "CM", x: 50, y: 38 },
    { pos: "LW", x: 54, y: 16 },
    { pos: "ST", x: 80, y: 50 },
  ],
  "3-6-1": [
    { pos: "GK", x: 5,  y: 50 },
    { pos: "CB", x: 17, y: 70 },
    { pos: "CB", x: 14, y: 50 },
    { pos: "CB", x: 17, y: 30 },
    { pos: "RB", x: 44, y: 90 },
    { pos: "DM", x: 36, y: 60 },
    { pos: "DM", x: 36, y: 40 },
    { pos: "CM", x: 52, y: 64 },
    { pos: "CM", x: 52, y: 36 },
    { pos: "LB", x: 44, y: 10 },
    { pos: "ST", x: 80, y: 50 },
  ],
};

export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[];

/**
 * Effective OVR of a card playing in `slotPos`.
 * Natural position → full OVR. Same sector → −4. Cross-sector → −9.
 * GK in/out of goal is heavily penalized.
 */
export function effectiveOvr(card: Card, slotPos: Position): number {
  const positions = card.player.positions;
  if (positions.includes(slotPos)) return card.player.ovr;
  const isGkCard = positions.includes("GK");
  if (slotPos === "GK" && !isGkCard) return card.player.ovr - 25;
  if (slotPos !== "GK" && isGkCard) return card.player.ovr - 20;
  const sector = (p: Position) =>
    p === "GK" ? "GK"
    : ["RB", "CB", "LB"].includes(p) ? "DEF"
    : ["DM", "CM", "AM"].includes(p) ? "MID"
    : "ATT";
  const same = positions.some((p) => sector(p) === sector(slotPos));
  return card.player.ovr - (same ? 4 : 9);
}

/**
 * Greedy lineup assignment: highest-OVR cards claim their best slots first,
 * preferring natural positions. Returns array aligned with formation slots.
 */
export function assignLineup(cards: Card[], formation: FormationId): (Card | null)[] {
  const slots = FORMATIONS[formation];
  const lineup: (Card | null)[] = slots.map(() => null);
  const pool = [...cards].sort((a, b) => b.player.ovr - a.player.ovr);

  // Pass 1: natural positions
  for (const card of pool) {
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (lineup[i]) continue;
      if (!card.player.positions.includes(slots[i].pos)) continue;
      const score = effectiveOvr(card, slots[i].pos);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) lineup[best] = card;
  }
  // Pass 2: fill leftovers with least-bad assignment
  const leftovers = pool.filter((c) => !lineup.includes(c));
  for (const card of leftovers) {
    let best = -1, bestScore = -Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (lineup[i]) continue;
      const score = effectiveOvr(card, slots[i].pos);
      if (score > bestScore) { bestScore = score; best = i; }
    }
    if (best >= 0) lineup[best] = card;
  }
  return lineup;
}
