"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Card, CupState, FormationId, MatchResult, MatchTeam, Position, Tactics,
} from "./types";
import { FORMATIONS, assignLineup } from "./formations";
import { advanceCup, drawCup, recordUserResult, simulateRound, currentRound, nextUserFixture, buildAiTeam, LAST_ROUND } from "./cup";
import { SQUAD_BY_ID } from "@/lib/data/squads";
import { DEFAULT_EDITION_ID } from "@/lib/data/editions";
import { REROLL_BUDGET, BENCH_REROLL_BONUS } from "./rules";

export type CareerMode = "legends" | "wc2026";

export interface DraftSlot {
  pos: Position;
  card: Card | null;
}

export interface BenchSlot {
  pos: Position | null;
  card: Card | null;
}

export const USER_COLORS: [string, string] = ["#00FF87", "#0B1120"];
export const USER_KIT2: [string, string] = ["#F4F7F5", "#0B1120"];
export const BENCH_SIZE = 4;

interface CareerState {
  coachName: string;
  careerMode: CareerMode;    // "legends" = draft de lendas · "wc2026" = seleção atual
  editionId: string;         // chosen World Cup edition (host + year + stadiums)
  userColors: [string, string];  // chosen at career creation
  userColors2: [string, string]; // away kit
  draftFormation: FormationId;
  slots: DraftSlot[];        // 11, positions from draftFormation
  benchSlots: BenchSlot[];   // 4, position set by the chosen player
  draftDone: boolean;
  rerollsLeft: number;       // shared budget for extra roulette spins
  benchBonusGranted: boolean; // +1 reroll when the XI is complete
  introSeen: boolean;        // press-conference intro played?

  tactics: Tactics;
  lineupIds: (string | null)[]; // card player ids aligned to FORMATIONS[tactics.formation]
  benchIds: string[];
  morale: Record<string, number>; // player id → 20–99 (starts 70)
  userKit: 1 | 2;

  cup: CupState | null;
  lastResult: { fixtureId: string; result: MatchResult; round: number } | null;

  // actions
  newCareer: (coachName: string, editionId: string, formation: FormationId, kit?: { kit1: [string, string]; kit2: [string, string] }) => void;
  newCareer2026: (coachName: string, squadId: string, kit?: { kit1: [string, string]; kit2: [string, string] }) => void;
  setDraftFormation: (f: FormationId) => void;
  fillSlot: (index: number, card: Card) => void;
  fillBench: (index: number, card: Card) => void;
  spendReroll: () => void;
  grantBenchBonus: () => void;
  markIntroSeen: () => void;
  completeDraft: () => void;
  setFormation: (f: FormationId) => void;
  setTactics: (t: Partial<Tactics>) => void;
  setUserKit: (k: 1 | 2) => void;
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

const emptyBench = (): BenchSlot[] =>
  Array.from({ length: BENCH_SIZE }, (): BenchSlot => ({ pos: null, card: null }));

export function allCards(state: Pick<CareerState, "slots" | "benchSlots">): Card[] {
  return [...state.slots, ...state.benchSlots]
    .map((s) => s.card)
    .filter((c): c is Card => c !== null);
}

export function cardById(state: Pick<CareerState, "slots" | "benchSlots">, id: string | null): Card | null {
  if (!id) return null;
  return allCards(state).find((c) => c.player.id === id) ?? null;
}

export function userTeamName(s: Pick<CareerState, "coachName">): string {
  return s.coachName ? `Seleção ${s.coachName}` : "";
}

export function buildUserTeam(s: CareerState): MatchTeam {
  const cards = allCards(s);
  const byId = new Map(cards.map((c) => [c.player.id, c]));
  const colors = s.userKit === 2 ? (s.userColors2 ?? USER_KIT2) : (s.userColors ?? USER_COLORS);
  return {
    name: userTeamName(s),
    flag: "⭐",
    colors,
    tactics: s.tactics,
    lineup: s.lineupIds.map((id) => (id ? byId.get(id) ?? null : null)),
    bench: s.benchIds.map((id) => byId.get(id)).filter((c): c is Card => !!c),
    isUser: true,
  };
}

const initialTactics: Tactics = { formation: "4-2-3-1", mentality: "equilibrado", style: "posse" };

const freshCareer = {
  coachName: "",
  careerMode: "legends" as CareerMode,
  editionId: DEFAULT_EDITION_ID,
  userColors: USER_COLORS,
  userColors2: USER_KIT2,
  draftFormation: "4-2-3-1" as FormationId,
  slots: slotsForFormation("4-2-3-1"),
  benchSlots: emptyBench(),
  draftDone: false,
  rerollsLeft: REROLL_BUDGET,
  benchBonusGranted: false,
  introSeen: false,
  tactics: initialTactics,
  lineupIds: FORMATIONS["4-2-3-1"].map(() => null as string | null),
  benchIds: [] as string[],
  morale: {} as Record<string, number>,
  userKit: 1 as 1 | 2,
  cup: null as CupState | null,
  lastResult: null as CareerState["lastResult"],
};

const clampMorale = (v: number) => Math.min(99, Math.max(20, Math.round(v)));

export const useCareer = create<CareerState>()(
  persist(
    (set, get) => ({
      ...freshCareer,

      newCareer: (coachName, editionId, formation, kit) =>
        set({
          ...freshCareer,
          coachName,
          careerMode: "legends",
          editionId,
          userColors: kit?.kit1 ?? USER_COLORS,
          userColors2: kit?.kit2 ?? USER_KIT2,
          draftFormation: formation,
          slots: slotsForFormation(formation),
          tactics: { ...initialTactics, formation },
          lineupIds: FORMATIONS[formation].map(() => null),
        }),

      // "Copa 2026" mode: take charge of a current national team — no draft.
      newCareer2026: (coachName, squadId, kit) => {
        const squad = SQUAD_BY_ID[squadId];
        if (!squad) return;
        const team = buildAiTeam(squad);
        const formation = team.tactics.formation;
        const slots = FORMATIONS[formation].map((s, i) => ({ pos: s.pos, card: team.lineup[i] ?? null }));
        const benchCards = team.bench.slice(0, BENCH_SIZE);
        const benchSlots = Array.from({ length: BENCH_SIZE }, (_, i): BenchSlot => ({
          pos: benchCards[i]?.player.positions[0] ?? null,
          card: benchCards[i] ?? null,
        }));
        const morale: Record<string, number> = {};
        for (const c of [...team.lineup, ...benchCards]) if (c) morale[c.player.id] = 70;
        set({
          ...freshCareer,
          coachName,
          careerMode: "wc2026",
          editionId: "america-do-norte-2026",
          userColors: kit?.kit1 ?? squad.colors,
          userColors2: kit?.kit2 ?? squad.kit2,
          draftFormation: formation,
          slots,
          benchSlots,
          draftDone: true,
          rerollsLeft: 0,
          benchBonusGranted: true,
          tactics: { ...initialTactics, formation },
          lineupIds: slots.map((s) => s.card?.player.id ?? null),
          benchIds: benchCards.map((c) => c.player.id),
          morale,
        });
      },

      setDraftFormation: (f) =>
        set((s) => {
          // re-fit already-drafted cards onto the new formation
          const cards = s.slots.map((x) => x.card).filter((c): c is Card => !!c);
          const lineup = assignLineup(cards, f);
          const slots = FORMATIONS[f].map((slot, i) => ({ pos: slot.pos, card: lineup[i] ?? null }));
          return { draftFormation: f, slots, tactics: { ...s.tactics, formation: f } };
        }),

      fillSlot: (index, card) =>
        set((s) => {
          const slots = [...s.slots];
          slots[index] = { ...slots[index], card };
          return { slots, morale: { ...s.morale, [card.player.id]: 70 } };
        }),

      fillBench: (index, card) =>
        set((s) => {
          const benchSlots = [...s.benchSlots];
          benchSlots[index] = { pos: card.player.positions[0], card };
          return { benchSlots, morale: { ...s.morale, [card.player.id]: 70 } };
        }),

      spendReroll: () =>
        set((s) => ({ rerollsLeft: Math.max(0, s.rerollsLeft - 1) })),

      grantBenchBonus: () =>
        set((s) =>
          s.benchBonusGranted
            ? {}
            : { benchBonusGranted: true, rerollsLeft: s.rerollsLeft + BENCH_REROLL_BONUS }
        ),

      markIntroSeen: () => set({ introSeen: true }),

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

      setUserKit: (k) => set({ userKit: k }),

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
          { name: userTeamName(s), flag: "⭐", colors: s.userColors ?? USER_COLORS },
          Math.floor(Math.random() * 2 ** 31),
          s.editionId
        );
        set({ cup });
      },

      recordResult: (fixtureId, res, round) => {
        const s = get();
        if (!s.cup) return;
        const cup: CupState = JSON.parse(JSON.stringify(s.cup));
        const userIds = new Set(allCards(s).map((c) => c.player.id));
        const nameOf = (pid: string) => {
          const mine = allCards(s).find((c) => c.player.id === pid);
          if (mine) return mine.player.name;
          for (const sq of Object.values(SQUAD_BY_ID)) {
            const p = sq.players.find((x) => x.id === pid);
            if (p) return p.name;
          }
          return "";
        };
        recordUserResult(cup, fixtureId, res, nameOf, userIds);
        // Simulate the rest of the round "happening at the same time"
        simulateRound(cup, round);

        // Morale: results and individual performances move the locker room
        const f = cup.fixtures.find((x) => x.id === fixtureId)!;
        const userIsHome = f.homeId === "USER";
        const gf = userIsHome ? res.scoreH : res.scoreA;
        const ga = userIsHome ? res.scoreA : res.scoreH;
        const base = gf > ga ? 6 : gf === ga ? 1 : -6;
        const morale = { ...s.morale };
        for (const id of userIds) {
          const st = res.playerStats[id];
          if (!st) continue; // didn't play
          let delta = base;
          delta += st.goals * 4 + st.assists * 3 - st.cards * 2;
          if (st.rating >= 8) delta += 3;
          if (st.rating < 6) delta -= 3;
          morale[id] = clampMorale((morale[id] ?? 70) + delta);
        }

        // Advance phases; keep simulating rounds the user isn't part of
        let guard = 0;
        while (guard++ < 14) {
          advanceCup(cup);
          const nf = nextUserFixture(cup);
          if (!nf) {
            // user out (or cup over): simulate everything that remains
            const r = currentRound(cup);
            if (r > LAST_ROUND) { advanceCup(cup); break; }
            simulateRound(cup, r);
            continue;
          }
          // user plays nf.round — first simulate earlier unfinished rounds
          // (e.g. the 3rd-place match while the user waits for the final)
          let simmed = false;
          for (let r = 1; r < nf.round; r++) {
            if (cup.fixtures.some((x) => x.round === r && x.scoreH === null)) {
              simulateRound(cup, r);
              simmed = true;
            }
          }
          if (!simmed) break;
        }
        set({ cup, morale, lastResult: { fixtureId, result: res, round } });
      },

      clearLastResult: () => set({ lastResult: null }),

      resetAll: () => set({ ...freshCareer }),
    }),
    {
      name: "futbattle-career",
      version: 2,
      migrate: (persisted) => {
        // v1 saves (8-group cup, teamName, star caps) are incompatible with
        // the 2026 format — start clean, keeping nothing.
        const p = persisted as Partial<CareerState> & { teamName?: string };
        if (p && typeof p.coachName === "string") return p as CareerState;
        return { ...freshCareer } as CareerState;
      },
    }
  )
);

export { buildAiTeam };
