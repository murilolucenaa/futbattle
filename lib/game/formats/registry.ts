// ============================================================
// Registry de motores: mode + editionId → CupEngine.
// Tradicional = g48 sempre. Fiel = motor do ano da edição.
// ============================================================

import { EDITION_BY_ID } from "@/lib/data/editions";
import type { CupMode } from "@/lib/game/types";
import type { CupEngine } from "./types";
import { g48 } from "./g48";
import { g32 } from "./g32";
import { g24 } from "./g24";
import { g16 } from "./g16";
import { finalGroup1950 } from "./finalGroup1950";
import { groupsSemi1930 } from "./groupsSemi1930";
import { knockout1934, knockout1938 } from "./knockout";

// edições cujo modo Fiel ainda não existe (Fase 2): 1974, 1978, 1982
const FIEL_LOCKED_YEARS = new Set([1974, 1978, 1982]);

const FIEL_BY_YEAR: Record<number, CupEngine> = {
  1930: groupsSemi1930, 1934: knockout1934, 1938: knockout1938,
  1950: finalGroup1950,
  1954: g16, 1958: g16, 1962: g16, 1966: g16, 1970: g16,
  1986: g24, 1990: g24, 1994: g24,
  1998: g32, 2002: g32, 2006: g32, 2010: g32, 2014: g32, 2018: g32, 2022: g32,
  2026: g48,
};

export function editionYear(editionId: string): number {
  return EDITION_BY_ID[editionId]?.year ?? 2026;
}

export function fielAvailable(editionId: string): boolean {
  const y = editionYear(editionId);
  if (FIEL_LOCKED_YEARS.has(y)) return false;
  return !!FIEL_BY_YEAR[y];
}

export function engineFor(mode: CupMode, editionId: string): CupEngine {
  if (mode === "tradicional") return g48;
  const eng = FIEL_BY_YEAR[editionYear(editionId)];
  if (!eng) return g48; // fallback defensivo (UI impede chegar aqui travado)
  return eng;
}

export { FIEL_BY_YEAR };
