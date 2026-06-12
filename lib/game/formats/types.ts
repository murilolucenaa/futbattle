// ============================================================
// FUTBATTLE — interface de motor de formato de copa.
// Cada edição/modo resolve para um CupEngine que sabe montar o
// sorteio, avançar as fases, rotular rounds e decidir o campeão.
// ============================================================

import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";

export interface DrawContext {
  user: { name: string; flag: string; colors: [string, string] };
  seed: number;
  rand: () => number;
  editionId: string;
}

export interface DrawResult {
  teams: Record<string, CupTeamRef>;
  groups: Record<string, string[]>;
  userGroup: string;
  fixtures: Fixture[];
}

export interface CupEngine {
  id: string;
  teamCount: number;
  lastRound: number;
  build(ctx: DrawContext): DrawResult;
  advance(cup: CupState): void;            // constrói a próxima fase e seta cup.phase
  roundLabel(round: number): string;
  champion(cup: CupState): string | null;  // null enquanto não decidido
  podium(cup: CupState): [string, string, string] | null;
}
