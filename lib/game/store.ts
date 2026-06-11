"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Card, CupState, FormationId, MatchResult, MatchTeam, Position, Tactics,
} from "./types";
import { FORMATIONS, assignLineup } from "./formations";
import { advanceCup, drawCup, recordUserResult, simulateRound, currentRound, buildAiTeam } from "./cup";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import { REROLL_BUDGET } from "./rules";

export interface DraftSlot {
  pos: Position;
  card: Card | null;
}

export interface BenchSlot {
  pos: Position | null;
  card: Card | null;
}

export const USER_COLORS: [string, string] = ["#00FF87", "#0B1120"];
export const BENCH_SIZE = 4;

interface CareerState {
  teamName: string;
  draftFormation: FormationId;
  slots: DraftSlot[];        // 11, positions from draftFormation
  benchSlots: BenchSlot[];   // 4, position chosen by user
  draftDone: boolean;
  rerollsLeft: number;       // shared budget for extra roulette spins

  tactics: Tactics;
  lineupIds: (string | null)[]; // card player ids aligned to FORMATIONS[tactics.formation]
  benchIds: string[];

  cup: CupState | null;
  lastResult: { fixtureId: string; result: MatchResult; round: number } | null;

  // actions
  newCareer: (teamName: string, formation: FormationId) => void;
  fillSlot: (index: number, card: Card) => void;
  setBenchPos: (index: number, pos: Position | null) => void;
  fillBench: (index: number, card: Card) => void;
  spendReroll: () => void;
  completeDraft: () => void;
  setFormation: (f: FormationId) => void;
  setTactics: (t: Partial<Tactics>) => void;
  swapLineup: (a: number, b: number) => void;
  swapWithBench: (lineupIdx: number, benchId: string) => void;
  startCup: () => void;
  recordResult: (fixtureId: string, res: MatchResult, round: number) => void;
  clearLastResult: () => void;
  resetAll: () => void;
}

function slotsForFormation(f: FormationId): DraftSlot[] {
  return FORMATIONS[f].map((s) => ({ pos: s.pos, card: null }));
}

export function allCards(state: Pick<CareerState, "slots" | "benchSlots">): Card[] {
  return [...state.slots, ...state.benchSlots]
    .map((s) => s.card)
    .filter((c): c is Card => c !== null);
}

export function cardById(state: Pick<CareerState, "slots" | "benchSlots">, id: string | null): Card | null {
  if (!id) return null;
  return allCards(state).find((c) => c.player.id === id) ?? null;
}

export function buildUserTeam(s: CareerState): MatchTeam {
  const cards = allCards(s);
  const byId = new Map(cards.map((c) => [c.player.id, c]));
  return {
    name: s.teamName,
    flag: "⭐",
    colors: USER_COLORS,
    tactics: s.tactics,
    lineup: s.lineupIds.map((id) => (id ? byId.get(id) ?? null : null)),
    bench: s.benchIds.map((id) => byId.get(id)).filter((c): c is Card => !!c),
    isUser: true,
  };
}

const initialTactics: Tactics = { formation: "4-2-3-1", mentality: "equilibrado", style: "posse" };

export const useCareer = create<CareerState>()(
  persist(
    (set, get) => ({
      teamName: "",
      draftFormation: "4-2-3-1",
      slots: slotsForFormation("4-2-3-1"),
      benchSlots: Array.from({ length: BENCH_SIZE }, (): BenchSlot => ({ pos: null, card: null })),
      draftDone: false,
      rerollsLeft: REROLL_BUDGET,
      tactics: initialTactics,
      lineupIds: FORMATIONS["4-2-3-1"].map(() => null),
      benchIds: [],
      cup: null,
      lastResult: null,

      newCareer: (teamName, formation) =>
        set({
          teamName,
          draftFormation: formation,
          slots: slotsForFormation(formation),
          benchSlots: Array.from({ length: BENCH_SIZE }, (): BenchSlot => ({ pos: null, card: null })),
          draftDone: false,
          rerollsLeft: REROLL_BUDGET,
          tactics: { ...initialTactics, formation },
          lineupIds: FORMATIONS[formation].map(() => null),
          benchIds: [],
          cup: null,
          lastResult: null,
        }),

      fillSlot: (index, card) =>
        set((s) => {
          const slots = [...s.slots];
          slots[index] = { ...slots[index], card };
          return { slots };
        }),

      setBenchPos: (index, pos) =>
        set((s) => {
          const benchSlots = [...s.benchSlots];
          benchSlots[index] = { pos, card: benchSlots[index].card };
          return { benchSlots };
        }),

      fillBench: (index, card) =>
        set((s) => {
          const benchSlots = [...s.benchSlots];
          benchSlots[index] = { ...benchSlots[index], card };
          return { benchSlots };
        }),

      spendReroll: () =>
        set((s) => ({ rerollsLeft: Math.max(0, s.rerollsLeft - 1) })),

      completeDraft: () => {
        const s = get();
        const lineupIds = s.slots.map((slot) => slot.card?.player.id ?? null);
        const benchIds = s.benchSlots.filter((b) => b.card).map((b) => b.card!.player.id);
        set({ draftDone: true, lineupIds, benchIds, tactics: { ...s.tactics, formation: s.draftFormation } });
      },

      setFormation: (f) => {
        const s = get();
        const starters = s.lineupIds
          .map((id) => cardById(s, id))
          .filter((c): c is Card => !!c);
        const lineup = assignLineup(starters, f);
        set({
          tactics: { ...s.tactics, formation: f },
          lineupIds: lineup.map((c) => c?.player.id ?? null),
        });
      },

      setTactics: (t) => set((s) => ({ tactics: { ...s.tactics, ...t } })),

      swapLineup: (a, b) =>
        set((s) => {
          const lineupIds = [...s.lineupIds];
          [lineupIds[a], lineupIds[b]] = [lineupIds[b], lineupIds[a]];
          return { lineupIds };
        }),

      swapWithBench: (lineupIdx, benchId) =>
        set((s) => {
          const lineupIds = [...s.lineupIds];
          const benchIds = [...s.benchIds];
          const starterId = lineupIds[lineupIdx];
          const bi = benchIds.indexOf(benchId);
          if (bi < 0) return {};
          lineupIds[lineupIdx] = benchId;
          benchIds[bi] = starterId ?? benchIds[bi];
          if (!starterId) benchIds.splice(bi, 1);
          return { lineupIds, benchIds };
        }),

      startCup: () => {
        const s = get();
        const cup = drawCup(
          { name: s.teamName, flag: "⭐", colors: USER_COLORS },
          Math.floor(Math.random() * 2 ** 31)
        );
        set({ cup });
      },

      recordResult: (fixtureId, res, round) => {
        const s = get();
        if (!s.cup) return;
        const cup: CupState = JSON.parse(JSON.stringify(s.cup));
        const nameOf = (pid: string) => {
          const mine = allCards(s).find((c) => c.player.id === pid);
          if (mine) return mine.player.name;
          for (const sq of Object.values(SQUAD_BY_ID)) {
            const p = sq.players.find((x) => x.id === pid);
            if (p) return p.name;
          }
          return "";
        };
        recordUserResult(cup, fixtureId, res, nameOf);
        // Simulate the rest of the round "happening at the same time"
        simulateRound(cup, round);
        // Keep simulating rounds the user isn't part of (after elimination)
        let guard = 0;
        while (guard++ < 10) {
          advanceCup(cup);
          const r = currentRound(cup);
          if (r > 7) { advanceCup(cup); break; }
          const userPlays = cup.fixtures.some(
            (f) => f.round === r && f.scoreH === null && (f.homeId === "USER" || f.awayId === "USER")
          );
          if (userPlays) break;
          if (r <= 3) break; // group rounds always include the user
          simulateRound(cup, r);
        }
        set({ cup, lastResult: { fixtureId, result: res, round } });
      },

      clearLastResult: () => set({ lastResult: null }),

      resetAll: () =>
        set({
          teamName: "",
          draftFormation: "4-2-3-1",
          slots: slotsForFormation("4-2-3-1"),
          benchSlots: Array.from({ length: BENCH_SIZE }, (): BenchSlot => ({ pos: null, card: null })),
          draftDone: false,
          rerollsLeft: REROLL_BUDGET,
          tactics: initialTactics,
          lineupIds: FORMATIONS["4-2-3-1"].map(() => null),
          benchIds: [],
          cup: null,
          lastResult: null,
        }),
    }),
    { name: "futbattle-career" }
  )
);

export { buildAiTeam };
