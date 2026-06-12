// ============================================================
// Classificação de grupos — módulo sem dependências de cup.ts
// nem dos motores, para evitar ciclo de import (cup → registry →
// motores → standings, sem volta).
// ============================================================

import type { CupState, GroupRow } from "./types";
import { hashStr } from "./formats/shared";

const SORT = (x: GroupRow, y: GroupRow) =>
  y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || hashStr(x.teamId) - hashStr(y.teamId);

export function groupTable(cup: CupState, group: string): GroupRow[] {
  const rows: Record<string, GroupRow> = {};
  for (const id of cup.groups[group])
    rows[id] = { teamId: id, pts: 0, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0 };
  for (const f of cup.fixtures) {
    if (f.group !== group || f.scoreH === null || f.scoreA === null) continue;
    const h = rows[f.homeId], a = rows[f.awayId];
    h.p++; a.p++;
    h.gf += f.scoreH; h.ga += f.scoreA;
    a.gf += f.scoreA; a.ga += f.scoreH;
    if (f.scoreH > f.scoreA) { h.w++; h.pts += 3; a.l++; }
    else if (f.scoreH < f.scoreA) { a.w++; a.pts += 3; h.l++; }
    else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  return Object.values(rows).sort(SORT);
}

/** Terceiros colocados de todos os grupos, melhores primeiro. */
export function thirdPlaceTable(cup: CupState): GroupRow[] {
  return Object.keys(cup.groups)
    .filter((g) => g !== "FINAL") // ignora o pseudo-grupo final de 1950
    .map((g) => groupTable(cup, g)[2])
    .filter(Boolean)
    .sort(SORT);
}
