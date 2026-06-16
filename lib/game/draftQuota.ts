// Cota de convocação por função (19 convocados): a estrutura do draft, sem
// formação. Formação + XI são escolhidos depois, na prancheta.
import type { Card, Position, Role } from "./types";
import { POSITION_ROLE } from "./types";

export interface QuotaSlot { role: Role; reserve: boolean }

// Por função: N titulares + 1 reserva. Ordem = ordem visual do quadro.
const SPEC: [Role, number][] = [
  ["GOL", 1], ["ZAG", 2], ["LAT", 2], ["VOL", 2], ["MEI", 3], ["ATA", 3],
];

export const ROLE_QUOTA: QuotaSlot[] = SPEC.flatMap(([role, n]) => [
  ...Array.from({ length: n }, () => ({ role, reserve: false })),
  { role, reserve: true },
]);

export const SQUAD_SIZE = ROLE_QUOTA.length; // 19

export function roleOf(pos: Position): Role { return POSITION_ROLE[pos]; }

/** Funções nas quais a carta pode ser convocada (multi-posição acende várias). */
export function rolesOfCard(card: Card): Role[] {
  return [...new Set(card.player.positions.map((p) => POSITION_ROLE[p]))];
}
