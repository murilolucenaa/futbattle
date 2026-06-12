# Formatos de Copa por Edição — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada edição da Copa pode ser jogada no modo **Tradicional** (formato 2026 atual, qualquer ano) ou **Fiel** (formato real do ano), com popup de escolha, aviso fixo e mini-história ("?") por edição.

**Architecture:** Motores de formato isolados em `lib/game/formats/` implementam uma interface `CupEngine` comum; um registry mapeia `mode + editionId → motor`. `cup.ts` mantém os helpers genéricos e delega build/advance/labels/champion ao motor. `Fixture.knockout` substitui o `round >= 4` hardcoded.

**Tech Stack:** TypeScript, Zustand persist, Jest (ts-jest), Next 14, sem libs novas.

Spec: `docs/superpowers/specs/2026-06-12-edition-formats-design.md`

---

## Estrutura de arquivos

```
lib/game/types.ts                 # +CupMode, +Fixture.knockout, +CupState.mode, +CupPhase variants
lib/game/formats/types.ts         # CupEngine, DrawContext, DrawResult (CRIAR)
lib/game/formats/shared.ts        # roundRobin, pickTeams, stadium helpers, buildKnockout (CRIAR)
lib/game/formats/g48.ts           # motor 48 (refactor do atual) (CRIAR)
lib/game/formats/g32.ts           # motor 32 (CRIAR)
lib/game/formats/g24.ts           # motor 24 (6 grupos, top2+4 3ºs) (CRIAR)
lib/game/formats/g16.ts           # motor 16 (4 grupos → quartas) (CRIAR)
lib/game/formats/finalGroup1950.ts# motor 1950 (grupo final) (CRIAR)
lib/game/formats/registry.ts      # engineFor, fielAvailable, editionEngineId (CRIAR)
lib/game/cup.ts                    # delega ao motor; roundLabel(cup,r), lastRound(cup)
lib/data/editions.ts               # +lore por edição
lib/game/store.ts                  # persist v5, newCareer(mode), cupMode no estado, startCup
app/page.tsx                       # popup Fiel/Tradicional + retângulo aviso + "?"
app/cup/page.tsx                   # grupos/rounds derivados, roundLabel, 3ºs condicional, bracket genérico
app/match/page.tsx                 # roundLabel + f.knockout
```

---

### Task 1: Tipos base (`CupMode`, `Fixture.knockout`, `CupState.mode`)

**Files:**
- Modify: `lib/game/types.ts`

- [ ] **Step 1: Adicionar os tipos**

Em `lib/game/types.ts`, após a definição de `CupPhase` (linha ~190), adicionar `CupMode` e estender `CupPhase`:

```ts
export type CupMode = "fiel" | "tradicional";

export type CupPhase =
  | "groups" | "r32" | "r16" | "qf" | "sf" | "third" | "final"
  | "finalGroup" | "secondGroup"
  | "champion" | "eliminated";
```

Em `Fixture` (linha ~160), adicionar `knockout`:

```ts
export interface Fixture {
  id: string;
  round: number;
  group?: string;
  homeId: string;
  awayId: string;
  stadium?: string;
  knockout: boolean;          // true = mata-mata (pênaltis no empate); false = pontos corridos
  scoreH: number | null;
  scoreA: number | null;
  pensH?: number;
  pensA?: number;
  scorers?: { name: string; min: number; side: "h" | "a" }[];
}
```

Em `CupState` (linha ~194), adicionar `mode`:

```ts
export interface CupState {
  teams: Record<string, CupTeamRef>;
  groups: Record<string, string[]>;
  fixtures: Fixture[];
  phase: CupPhase;
  userGroup: string;
  seed: number;
  editionId: string;
  mode: CupMode;
  playerTotals: Record<string, PlayerTotals>;
}
```

Em `WCEdition` (linha ~59), adicionar `lore`:

```ts
export interface WCEdition {
  id: string;
  year: number;
  host: string;
  flag: string;
  era: PitchEra;
  lore?: string;
  stadiums: Stadium[];
}
```

- [ ] **Step 2: Type-check (vai falhar — esperado)**

Run: `npx tsc --noEmit`
Expected: erros em `cup.ts`/`store.ts` por falta de `knockout`/`mode`. Serão corrigidos nas próximas tasks. NÃO commitar ainda.

---

### Task 2: Interface de motor (`formats/types.ts`)

**Files:**
- Create: `lib/game/formats/types.ts`

- [ ] **Step 1: Criar a interface**

```ts
// lib/game/formats/types.ts
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/game/types.ts lib/game/formats/types.ts
git commit -m "feat(formats): cup engine interface + CupMode/knockout types"
```

---

### Task 3: Helpers compartilhados (`formats/shared.ts`)

**Files:**
- Create: `lib/game/formats/shared.ts`
- Test: `lib/game/formats/__tests__/shared.test.ts`

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/shared.test.ts
import { roundRobin, pickOpponents } from "../shared";
import { mulberry32 } from "@/lib/game/engine";
import { SQUADS } from "@/lib/data/squads";

describe("roundRobin", () => {
  it("4 times → 3 rodadas de 2 jogos, todos contra todos", () => {
    const rounds = roundRobin(["a", "b", "c", "d"]);
    expect(rounds).toHaveLength(3);
    rounds.forEach((r) => expect(r).toHaveLength(2));
    const pairs = rounds.flat().map(([x, y]) => [x, y].sort().join("-")).sort();
    expect(new Set(pairs).size).toBe(6); // C(4,2)
  });

  it("3 times → 3 rodadas com 1 jogo (1 bye por rodada)", () => {
    const rounds = roundRobin(["a", "b", "c"]);
    expect(rounds).toHaveLength(3);
    expect(rounds.flat()).toHaveLength(3); // C(3,2)
  });

  it("2 times → 1 rodada, 1 jogo", () => {
    const rounds = roundRobin(["a", "b"]);
    expect(rounds.flat()).toEqual([["a", "b"]]);
  });
});

describe("pickOpponents", () => {
  it("retorna n squads distintos e é determinístico por seed", () => {
    const a = pickOpponents(SQUADS, mulberry32(5), 12);
    const b = pickOpponents(SQUADS, mulberry32(5), 12);
    expect(a).toHaveLength(12);
    expect(new Set(a.map((s) => s.id)).size).toBe(12);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });
});
```

- [ ] **Step 2: Rodar — falha (módulo não existe)**

Run: `npx jest formats/__tests__/shared.test.ts`
Expected: FAIL "Cannot find module '../shared'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/shared.ts
import { EDITION_BY_ID, DEFAULT_EDITION_ID } from "@/lib/data/editions";
import type { Fixture, SquadDef } from "@/lib/game/types";

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Round-robin via círculo. Suporta tamanho ímpar (bye). Cada rodada = lista de pares. */
export function roundRobin(ids: string[]): [string, string][][] {
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push("__BYE__");
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a !== "__BYE__" && b !== "__BYE__") pairs.push([a, b]);
    }
    rounds.push(pairs);
    // rotate, fixing arr[0]
    arr.splice(1, 0, arr.pop()!);
  }
  return rounds;
}

/** n adversários distintos do pool, embaralhados deterministicamente. */
export function pickOpponents(pool: SquadDef[], rand: () => number, n: number): SquadDef[] {
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function editionStadiums(editionId: string) {
  return (EDITION_BY_ID[editionId] ?? EDITION_BY_ID[DEFAULT_EDITION_ID]).stadiums;
}

/** Estádio determinístico por chave (jogos de grupo). */
export function stadiumByKey(editionId: string, key: string): string {
  const st = editionStadiums(editionId);
  const s = st[hashStr(key) % st.length];
  return `${s.name} · ${s.city}`;
}

/** Estádios grandes para o mata-mata (rank 0 = maior). */
export function bigStadium(editionId: string, rank: number): string {
  const byCap = [...editionStadiums(editionId)].sort((a, b) => b.capacity - a.capacity);
  const s = byCap[rank % byCap.length];
  return `${s.name} · ${s.city}`;
}

/** Cria fixtures de mata-mata pareando em ordem de chave. */
export function buildKnockout(
  editionId: string, qualifiers: string[], round: number, idPrefix: string,
  bigStadiumRankBase = 0
): Fixture[] {
  const out: Fixture[] = [];
  for (let i = 0; i < qualifiers.length; i += 2) {
    out.push({
      id: `${idPrefix}-${i / 2}`, round,
      homeId: qualifiers[i], awayId: qualifiers[i + 1],
      stadium: bigStadium(editionId, bigStadiumRankBase + i / 2),
      knockout: true, scoreH: null, scoreA: null,
    });
  }
  return out;
}
```

- [ ] **Step 4: Rodar — passa**

Run: `npx jest formats/__tests__/shared.test.ts`
Expected: PASS (3 + 1)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/shared.ts lib/game/formats/__tests__/shared.test.ts
git commit -m "feat(formats): shared helpers (roundRobin, pickOpponents, stadiums, knockout)"
```

---

### Task 4: Motor g48 (refactor do formato atual, com paridade)

**Files:**
- Create: `lib/game/formats/g48.ts`
- Test: `lib/game/formats/__tests__/g48.test.ts`

O g48 reproduz EXATAMENTE o `drawCup`/`advanceCup` atuais de `cup.ts` (linhas 86–133 e 285–394), apenas reembrulhado na interface `CupEngine`, com `knockout: true` nos fixtures de mata-mata e `knockout: false` nos de grupo. Mantém `groupTable`/`thirdPlaceTable`/`r32Qualifiers` (que ficam em `cup.ts` e são importados aqui).

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/g48.test.ts
import { g48 } from "../g48";
import { mulberry32 } from "@/lib/game/engine";

const ctx = {
  user: { name: "Brasil do Murilo", flag: "⭐", colors: ["#FFDC00", "#009739"] as [string, string] },
  seed: 99, rand: mulberry32(99), editionId: "america-do-norte-2026",
};

describe("g48", () => {
  it("48 times, 12 grupos de 4, 72 jogos de grupo (não-knockout)", () => {
    const d = g48.build({ ...ctx, rand: mulberry32(99) });
    expect(Object.keys(d.teams)).toHaveLength(48);
    expect(Object.keys(d.groups)).toHaveLength(12);
    Object.values(d.groups).forEach((g) => expect(g).toHaveLength(4));
    expect(d.fixtures).toHaveLength(72);
    expect(d.fixtures.every((f) => f.knockout === false)).toBe(true);
    expect(d.userGroup).toMatch(/^[A-L]$/);
  });

  it("determinístico: mesmo seed ⇒ mesmos grupos", () => {
    const a = g48.build({ ...ctx, rand: mulberry32(7) });
    const b = g48.build({ ...ctx, rand: mulberry32(7) });
    expect(a.groups).toEqual(b.groups);
  });

  it("lastRound 9, labels coerentes", () => {
    expect(g48.lastRound).toBe(9);
    expect(g48.roundLabel(4)).toBe("16 avos de final");
    expect(g48.roundLabel(9)).toBe("FINAL");
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx jest formats/__tests__/g48.test.ts`
Expected: FAIL "Cannot find module '../g48'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/g48.ts
import { SQUADS, squadLabel } from "@/lib/data/squads";
import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable, thirdPlaceTable } from "@/lib/game/cup";
import { bigStadium, buildKnockout, pickOpponents, stadiumByKey } from "./shared";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const GROUP_NAMES = ["A","B","C","D","E","F","G","H","I","J","K","L"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "16 avos de final", 5: "Oitavas de final", 6: "Quartas de final",
  7: "Semifinal", 8: "Disputa de 3º lugar", 9: "FINAL",
};

const GROUP_PAIRS: [number, number][][] = [
  [[0,1],[2,3]], [[0,2],[3,1]], [[0,3],[1,2]],
];

function buildGroups(ctx: DrawContext, count: number, groupNames: string[]) {
  const rand = ctx.rand;
  const opponents = pickOpponents(SQUADS, rand, count - 1);
  const teams: Record<string, CupTeamRef> = {
    USER: { squadId: "USER", name: ctx.user.name, flag: ctx.user.flag, colors: ctx.user.colors },
  };
  for (const s of opponents) teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
  const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
  const groups: Record<string, string[]> = {};
  const per = count / groupNames.length;
  groupNames.forEach((g, i) => { groups[g] = ids.slice(i * per, i * per + per); });
  const userGroup = groupNames.find((g) => groups[g].includes("USER"))!;
  return { teams, groups, userGroup };
}

function groupFixtures(editionId: string, groups: Record<string, string[]>, groupNames: string[]): Fixture[] {
  const fixtures: Fixture[] = [];
  for (const g of groupNames) {
    GROUP_PAIRS.forEach((roundPairs, ri) => {
      roundPairs.forEach(([x, y], pi) => {
        const id = `g${g}-r${ri + 1}-${pi}`;
        fixtures.push({
          id, round: ri + 1, group: g,
          homeId: groups[g][x], awayId: groups[g][y],
          stadium: stadiumByKey(editionId, id),
          knockout: false, scoreH: null, scoreA: null,
        });
      });
    });
  }
  return fixtures;
}

function r32Qualifiers(cup: CupState): string[] {
  const out: string[] = [];
  for (const g of GROUP_NAMES) { const t = groupTable(cup, g); out.push(t[0].teamId, t[1].teamId); }
  out.push(...thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId));
  return out;
}

function buildR32(cup: CupState): void {
  const W: Record<string, string> = {}, R: Record<string, string> = {};
  for (const g of GROUP_NAMES) { const t = groupTable(cup, g); W[g] = t[0].teamId; R[g] = t[1].teamId; }
  const thirds = thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId);
  const groupOf = (id: string) => GROUP_NAMES.find((g) => cup.groups[g].includes(id))!;
  const ties: [string, string][] = [
    [W.A, thirds[7]], [R.E, R.J], [W.C, thirds[5]], [W.I, R.A],
    [W.E, thirds[3]], [R.F, R.I], [W.G, thirds[1]], [W.K, R.C],
    [W.B, thirds[6]], [R.G, R.L], [W.D, thirds[4]], [W.J, R.B],
    [W.F, thirds[2]], [R.H, R.K], [W.H, thirds[0]], [W.L, R.D],
  ];
  for (let i = 0; i < ties.length; i++) {
    const [home, away] = ties[i];
    if (groupOf(home) !== groupOf(away)) continue;
    for (let j = 0; j < ties.length; j++) {
      if (i === j) continue;
      const [h2, a2] = ties[j];
      if (!thirds.includes(a2)) continue;
      if (groupOf(home) !== groupOf(a2) && groupOf(h2) !== groupOf(away)) {
        ties[i] = [home, a2]; ties[j] = [h2, away]; break;
      }
    }
  }
  ties.forEach(([h, a], i) => {
    cup.fixtures.push({
      id: `ko4-${i}`, round: 4, homeId: h, awayId: a,
      stadium: bigStadium(cup.editionId, (i + 4) % 16),
      knockout: true, scoreH: null, scoreA: null,
    });
  });
  cup.phase = "r32";
}

function winnersOf(fixtures: Fixture[]): string[] {
  return fixtures.map((f) =>
    winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.homeId : f.awayId);
}

export const g48: CupEngine = {
  id: "g48",
  teamCount: 48,
  lastRound: 9,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 48, GROUP_NAMES);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUP_NAMES) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) { buildR32(cup); return; }
    for (let round = 5; round <= 7; round++) {
      const prev = cup.fixtures.filter((f) => f.round === round - 1);
      if (prev.length === 0 || prev.some((f) => f.scoreH === null)) continue;
      if (cup.fixtures.some((f) => f.round === round)) continue;
      const winners = winnersOf(prev);
      for (let i = 0; i < winners.length; i += 2) {
        cup.fixtures.push({
          id: `ko${round}-${i / 2}`, round, homeId: winners[i], awayId: winners[i + 1],
          stadium: bigStadium(cup.editionId, (round + i / 2) % 16),
          knockout: true, scoreH: null, scoreA: null,
        });
      }
      cup.phase = round === 5 ? "r16" : round === 6 ? "qf" : "sf";
      return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 7);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 9)) {
      const winners = winnersOf(sfs);
      const losers = sfs.map((f) =>
        winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko8-0", round: 8, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko9-0", round: 9, homeId: winners[0], awayId: winners[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 8);
    const final = cup.fixtures.find((f) => f.round === 9);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) {
      const champ = winnersOf([final])[0];
      cup.phase = champ === "USER" ? "champion" : "eliminated";
    }
  },
  champion(cup) {
    const final = cup.fixtures.find((f) => f.round === 9);
    if (!final || final.scoreH === null) return null;
    return winnersOf([final])[0];
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 9);
    const third = cup.fixtures.find((f) => f.round === 8);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [
      fw === "h" ? final.homeId : final.awayId,
      fw === "h" ? final.awayId : final.homeId,
      tw === "h" ? third.homeId : third.awayId,
    ];
  },
};

// re-exporta helpers de grupos para os outros motores
export { buildGroups, groupFixtures, winnersOf };
```

- [ ] **Step 4: Rodar — passa**

Run: `npx jest formats/__tests__/g48.test.ts`
Expected: PASS (3)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/g48.ts lib/game/formats/__tests__/g48.test.ts
git commit -m "feat(formats): g48 engine (paridade com o formato 2026 atual)"
```

---

### Task 5: Religar `cup.ts` aos motores (delegação) + registry mínimo

**Files:**
- Create: `lib/game/formats/registry.ts`
- Modify: `lib/game/cup.ts`

Objetivo: `cup.ts` para de hardcodar o formato. `drawCup` ganha `mode`, `advanceCup` delega, `roundLabel(cup,r)`/`lastRound(cup)`/`podium(cup)` delegam. **Comportamento do 2026 não muda.** `groupTable`/`thirdPlaceTable` continuam em `cup.ts` (g48 os importa).

- [ ] **Step 1: Criar o registry (só g48 por enquanto)**

```ts
// lib/game/formats/registry.ts
import { EDITION_BY_ID } from "@/lib/data/editions";
import type { CupMode } from "@/lib/game/types";
import type { CupEngine } from "./types";
import { g48 } from "./g48";

// editions cujo modo Fiel ainda não existe (Fase 2): 1974, 1978, 1982
const FIEL_LOCKED_YEARS = new Set([1974, 1978, 1982]);

// preenchido nas tasks 6–9; g48 cobre 2026
const FIEL_BY_YEAR: Record<number, CupEngine> = {
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
```

- [ ] **Step 2: Editar `cup.ts` — drawCup, advanceCup, labels, podium**

Em `lib/game/cup.ts`:

1. Adicionar imports no topo:
```ts
import { engineFor } from "./formats/registry";
import type { CupMode } from "./types";
```

2. Substituir `ROUND_LABEL`/`LAST_ROUND` por funções delegadoras. Manter um fallback estático para textos genéricos não usados por motor:
```ts
export function roundLabel(cup: CupState, round: number): string {
  return engineFor(cup.mode, cup.editionId).roundLabel(round);
}
export function lastRound(cup: CupState): number {
  return engineFor(cup.mode, cup.editionId).lastRound;
}
```
Remover a constante `LAST_ROUND` e o objeto `ROUND_LABEL` exportados (consumidores migram nas tasks 11–14). Manter `GROUP_NAMES` export (g48 usa 12; cup page passará a derivar de `cup.groups`).

3. Reescrever `drawCup`:
```ts
export function drawCup(
  user: { name: string; flag: string; colors: [string, string] },
  seed: number,
  editionId: string = DEFAULT_EDITION_ID,
  mode: CupMode = "tradicional",
): CupState {
  const engine = engineFor(mode, editionId);
  const rand = mulberry32(seed);
  const { teams, groups, userGroup, fixtures } = engine.build({ user, seed, rand, editionId });
  return { teams, groups, fixtures, phase: "groups", userGroup, seed, editionId, mode, playerTotals: {} };
}
```
Remover o corpo antigo de `drawCup` (sorteio + grupos + pairs) — agora vive em `g48.ts`.

4. Reescrever `advanceCup` para delegar:
```ts
export function advanceCup(cup: CupState): void {
  engineFor(cup.mode, cup.editionId).advance(cup);
}
```
Remover `buildR32` de `cup.ts` (movido para g48).

5. Reescrever `podium`:
```ts
export function podium(cup: CupState): [string, string, string] | null {
  return engineFor(cup.mode, cup.editionId).podium(cup);
}
```

6. Em `simulateRound`, trocar `round >= 4` por flag do fixture:
```ts
const res = runFullMatch(home, away, fixtureSeed(cup, f), f.knockout);
```

7. `currentRound`: trocar o limite `LAST_ROUND` por `lastRound(cup)`:
```ts
export function currentRound(cup: CupState): number {
  const last = lastRound(cup);
  for (let r = 1; r <= last; r++) {
    const fs = cup.fixtures.filter((f) => f.round === r);
    if (fs.length > 0 && fs.some((f) => f.scoreH === null)) return r;
  }
  return last + 1;
}
```

8. `userAlive`: as partes específicas de 2026 (rounds 5–7, r32Qualifiers) só valem pro g48. Generalizar para usar `nextUserFixture` + checagem de campeão do motor:
```ts
export function userAlive(cup: CupState): boolean {
  if (cup.phase === "champion") return true;
  if (cup.phase === "eliminated") return false;
  if (nextUserFixture(cup)) return true;
  // sem próximo jogo agendado: avança fases até surgir um jogo do usuário ou acabar
  const probe: CupState = JSON.parse(JSON.stringify(cup));
  let guard = 0;
  while (guard++ < 20) {
    advanceCup(probe);
    if (probe.phase === "champion") return true;
    if (probe.phase === "eliminated") return false;
    if (nextUserFixture(probe)) return true;
    // se não há mais jogos não-jogados, encerra
    if (!probe.fixtures.some((f) => f.scoreH === null)) return false;
  }
  return false;
}
```

- [ ] **Step 3: Type-check + testes existentes**

Run: `npx tsc --noEmit` (ainda haverá erros em store/UI — ok) então `npx jest lib/game/__tests__ formats/__tests__`
Expected: testes de `formats/` e do motor de partida PASS. Se `lib/game/__tests__/game.test.ts` referenciar `ROUND_LABEL`/`LAST_ROUND`, ajustar o teste para `roundLabel(cup,r)`/`lastRound(cup)`.

- [ ] **Step 4: Commit**

```bash
git add lib/game/cup.ts lib/game/formats/registry.ts lib/game/__tests__
git commit -m "refactor(cup): delega build/advance/labels ao motor; drawCup ganha mode"
```

---

### Task 6: Motor g32 (1998–2022)

**Files:**
- Create: `lib/game/formats/g32.ts`
- Test: `lib/game/formats/__tests__/g32.test.ts`

32 times, 8 grupos de 4 → top 2 (16) → Oitavas(4) → Quartas(5) → Semi(6) → 3º(7) → Final(8).

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/g32.test.ts
import { g32 } from "../g32";
import { advanceCup } from "@/lib/game/cup";
import { mulberry32 } from "@/lib/game/engine";

const base = {
  user: { name: "User", flag: "⭐", colors: ["#fff", "#000"] as [string, string] },
  seed: 3, editionId: "franca-1998",
};

describe("g32", () => {
  it("32 times, 8 grupos, 48 jogos de grupo", () => {
    const d = g32.build({ ...base, rand: mulberry32(3) });
    expect(Object.keys(d.teams)).toHaveLength(32);
    expect(Object.keys(d.groups)).toHaveLength(8);
    expect(d.fixtures).toHaveLength(48);
    expect(d.fixtures.every((f) => !f.knockout)).toBe(true);
  });
  it("lastRound 8, label round 4 = Oitavas", () => {
    expect(g32.lastRound).toBe(8);
    expect(g32.roundLabel(4)).toBe("Oitavas de final");
    expect(g32.roundLabel(8)).toBe("FINAL");
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx jest formats/__tests__/g32.test.ts`
Expected: FAIL "Cannot find module '../g32'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/g32.ts
import type { CupState, Fixture } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/cup";
import { bigStadium } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D","E","F","G","H"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Oitavas de final", 5: "Quartas de final", 6: "Semifinal",
  7: "Disputa de 3º lugar", 8: "FINAL",
};

// pareamento clássico 1A×2B, 1C×2D, … (lados cruzados)
function r16Qualifiers(cup: CupState): string[] {
  const W: string[] = [], R: string[] = [];
  for (const g of GROUPS) { const t = groupTable(cup, g); W.push(t[0].teamId); R.push(t[1].teamId); }
  // ordem: W0 R1 W2 R3 W4 R5 W6 R7 | W1 R0 W3 R2 W5 R4 W7 R6
  return [
    W[0], R[1], W[2], R[3], W[4], R[5], W[6], R[7],
    W[1], R[0], W[3], R[2], W[5], R[4], W[7], R[6],
  ];
}

export const g32: CupEngine = {
  id: "g32",
  teamCount: 32,
  lastRound: 8,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 32, GROUPS);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUPS) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const q = r16Qualifiers(cup);
      q.forEach((_, i) => { if (i % 2 === 0) cup.fixtures.push({
        id: `ko4-${i / 2}`, round: 4, homeId: q[i], awayId: q[i + 1],
        stadium: bigStadium(cup.editionId, (i / 2 + 4) % 12), knockout: true, scoreH: null, scoreA: null,
      }); });
      cup.phase = "r16"; return;
    }
    for (let round = 5; round <= 6; round++) {
      const prev = cup.fixtures.filter((f) => f.round === round - 1);
      if (prev.length === 0 || prev.some((f) => f.scoreH === null) || cup.fixtures.some((f) => f.round === round)) continue;
      const w = winnersOf(prev);
      for (let i = 0; i < w.length; i += 2) cup.fixtures.push({
        id: `ko${round}-${i / 2}`, round, homeId: w[i], awayId: w[i + 1],
        stadium: bigStadium(cup.editionId, (round + i / 2) % 12), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = round === 5 ? "qf" : "sf"; return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 6);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 8)) {
      const w = winnersOf(sfs);
      const losers = sfs.map((f) => winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko7-0", round: 7, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko8-0", round: 8, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 7);
    const final = cup.fixtures.find((f) => f.round === 8);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 8);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 8);
    const third = cup.fixtures.find((f) => f.round === 7);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [fw === "h" ? final.homeId : final.awayId, fw === "h" ? final.awayId : final.homeId, tw === "h" ? third.homeId : third.awayId];
  },
};
```

- [ ] **Step 4: Registrar e testar**

Em `registry.ts`, adicionar `import { g32 } from "./g32";` e no `FIEL_BY_YEAR`: `1998: g32, 2002: g32, 2006: g32, 2010: g32, 2014: g32, 2018: g32, 2022: g32,`.

Run: `npx jest formats/__tests__/g32.test.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/g32.ts lib/game/formats/__tests__/g32.test.ts lib/game/formats/registry.ts
git commit -m "feat(formats): g32 engine (1998–2022)"
```

---

### Task 7: Motor g24 (1986–94, 6 grupos, top2 + 4 melhores 3ºs)

**Files:**
- Create: `lib/game/formats/g24.ts`
- Test: `lib/game/formats/__tests__/g24.test.ts`

24 times, 6 grupos de 4 → 12 (top2) + 4 melhores 3ºs = 16 → Oitavas(4) → Quartas(5) → Semi(6) → 3º(7) → Final(8).

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/g24.test.ts
import { g24 } from "../g24";
import { mulberry32 } from "@/lib/game/engine";

const base = { user: { name: "U", flag: "⭐", colors: ["#fff","#000"] as [string,string] }, seed: 8, editionId: "mexico-1986" };

describe("g24", () => {
  it("24 times, 6 grupos, 36 jogos de grupo", () => {
    const d = g24.build({ ...base, rand: mulberry32(8) });
    expect(Object.keys(d.teams)).toHaveLength(24);
    expect(Object.keys(d.groups)).toHaveLength(6);
    expect(d.fixtures).toHaveLength(36);
  });
  it("lastRound 8, round 4 = Oitavas", () => {
    expect(g24.lastRound).toBe(8);
    expect(g24.roundLabel(4)).toBe("Oitavas de final");
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx jest formats/__tests__/g24.test.ts`
Expected: FAIL "Cannot find module '../g24'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/g24.ts
import type { CupState } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/cup";
import { bigStadium } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import { hashStr } from "./shared";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D","E","F"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Oitavas de final", 5: "Quartas de final", 6: "Semifinal",
  7: "Disputa de 3º lugar", 8: "FINAL",
};

function r16Qualifiers(cup: CupState): string[] {
  const W: string[] = [], R: string[] = [];
  for (const g of GROUPS) { const t = groupTable(cup, g); W.push(t[0].teamId); R.push(t[1].teamId); }
  const thirds = GROUPS.map((g) => groupTable(cup, g)[2])
    .sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || hashStr(x.teamId) - hashStr(y.teamId))
    .slice(0, 4).map((r) => r.teamId);
  // 16 = 6W + 6R + 4T, pareados em ordem de chave
  const pool = [...W, ...R, ...thirds];
  return pool;
}

export const g24: CupEngine = {
  id: "g24",
  teamCount: 24,
  lastRound: 8,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 24, GROUPS);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUPS) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const q = r16Qualifiers(cup);
      for (let i = 0; i < q.length; i += 2) cup.fixtures.push({
        id: `ko4-${i / 2}`, round: 4, homeId: q[i], awayId: q[i + 1],
        stadium: bigStadium(cup.editionId, (i / 2 + 4) % 12), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "r16"; return;
    }
    for (let round = 5; round <= 6; round++) {
      const prev = cup.fixtures.filter((f) => f.round === round - 1);
      if (prev.length === 0 || prev.some((f) => f.scoreH === null) || cup.fixtures.some((f) => f.round === round)) continue;
      const w = winnersOf(prev);
      for (let i = 0; i < w.length; i += 2) cup.fixtures.push({
        id: `ko${round}-${i / 2}`, round, homeId: w[i], awayId: w[i + 1],
        stadium: bigStadium(cup.editionId, (round + i / 2) % 12), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = round === 5 ? "qf" : "sf"; return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 6);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 8)) {
      const w = winnersOf(sfs);
      const losers = sfs.map((f) => winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko7-0", round: 7, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko8-0", round: 8, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 7);
    const final = cup.fixtures.find((f) => f.round === 8);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 8);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 8);
    const third = cup.fixtures.find((f) => f.round === 7);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [fw === "h" ? final.homeId : final.awayId, fw === "h" ? final.awayId : final.homeId, tw === "h" ? third.homeId : third.awayId];
  },
};
```

- [ ] **Step 4: Registrar e testar**

Em `registry.ts`: `import { g24 } from "./g24";` e `1986: g24, 1990: g24, 1994: g24,` no `FIEL_BY_YEAR`.

Run: `npx jest formats/__tests__/g24.test.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/g24.ts lib/game/formats/__tests__/g24.test.ts lib/game/formats/registry.ts
git commit -m "feat(formats): g24 engine (1986–94, melhores 3ºs)"
```

---

### Task 8: Motor g16 (1954–70, 4 grupos → quartas)

**Files:**
- Create: `lib/game/formats/g16.ts`
- Test: `lib/game/formats/__tests__/g16.test.ts`

16 times, 4 grupos de 4 → top2 (8) → Quartas(4) → Semi(5) → 3º(6) → Final(7).

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/g16.test.ts
import { g16 } from "../g16";
import { mulberry32 } from "@/lib/game/engine";

const base = { user: { name: "U", flag: "⭐", colors: ["#fff","#000"] as [string,string] }, seed: 2, editionId: "mexico-1970" };

describe("g16", () => {
  it("16 times, 4 grupos, 24 jogos de grupo", () => {
    const d = g16.build({ ...base, rand: mulberry32(2) });
    expect(Object.keys(d.teams)).toHaveLength(16);
    expect(Object.keys(d.groups)).toHaveLength(4);
    expect(d.fixtures).toHaveLength(24);
  });
  it("lastRound 7, round 4 = Quartas, sem oitavas", () => {
    expect(g16.lastRound).toBe(7);
    expect(g16.roundLabel(4)).toBe("Quartas de final");
    expect(g16.roundLabel(7)).toBe("FINAL");
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx jest formats/__tests__/g16.test.ts`
Expected: FAIL "Cannot find module '../g16'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/g16.ts
import type { CupState } from "@/lib/game/types";
import { winnerOf } from "@/lib/game/engine";
import { groupTable } from "@/lib/game/cup";
import { bigStadium } from "./shared";
import { buildGroups, groupFixtures, winnersOf } from "./g48";
import type { CupEngine, DrawResult } from "./types";

const GROUPS = ["A","B","C","D"];
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Quartas de final", 5: "Semifinal", 6: "Disputa de 3º lugar", 7: "FINAL",
};

// QF clássico: 1A×2B, 1C×2D, 1B×2A, 1D×2C
function qfQualifiers(cup: CupState): string[] {
  const W: Record<string, string> = {}, R: Record<string, string> = {};
  for (const g of GROUPS) { const t = groupTable(cup, g); W[g] = t[0].teamId; R[g] = t[1].teamId; }
  return [W.A, R.B, W.C, R.D, W.B, R.A, W.D, R.C];
}

export const g16: CupEngine = {
  id: "g16",
  teamCount: 16,
  lastRound: 7,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx): DrawResult {
    const { teams, groups, userGroup } = buildGroups(ctx, 16, GROUPS);
    return { teams, groups, userGroup, fixtures: groupFixtures(ctx.editionId, groups, GROUPS) };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round === 4)) {
      const q = qfQualifiers(cup);
      for (let i = 0; i < q.length; i += 2) cup.fixtures.push({
        id: `ko4-${i / 2}`, round: 4, homeId: q[i], awayId: q[i + 1],
        stadium: bigStadium(cup.editionId, (i / 2 + 2) % 8), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "qf"; return;
    }
    const qf = cup.fixtures.filter((f) => f.round === 4);
    if (qf.length === 4 && qf.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 5)) {
      const w = winnersOf(qf);
      for (let i = 0; i < w.length; i += 2) cup.fixtures.push({
        id: `ko5-${i / 2}`, round: 5, homeId: w[i], awayId: w[i + 1],
        stadium: bigStadium(cup.editionId, (5 + i / 2) % 8), knockout: true, scoreH: null, scoreA: null,
      });
      cup.phase = "sf"; return;
    }
    const sfs = cup.fixtures.filter((f) => f.round === 5);
    if (sfs.length === 2 && sfs.every((f) => f.scoreH !== null) && !cup.fixtures.some((f) => f.round === 7)) {
      const w = winnersOf(sfs);
      const losers = sfs.map((f) => winnerOf({ scoreH: f.scoreH!, scoreA: f.scoreA!, pensH: f.pensH, pensA: f.pensA }) === "h" ? f.awayId : f.homeId);
      cup.fixtures.push({ id: "ko6-0", round: 6, homeId: losers[0], awayId: losers[1], stadium: bigStadium(cup.editionId, 1), knockout: true, scoreH: null, scoreA: null });
      cup.fixtures.push({ id: "ko7-0", round: 7, homeId: w[0], awayId: w[1], stadium: bigStadium(cup.editionId, 0), knockout: true, scoreH: null, scoreA: null });
      cup.phase = "third"; return;
    }
    const third = cup.fixtures.find((f) => f.round === 6);
    const final = cup.fixtures.find((f) => f.round === 7);
    if (third && third.scoreH !== null && final && final.scoreH === null) { cup.phase = "final"; return; }
    if (final && final.scoreH !== null) cup.phase = winnersOf([final])[0] === "USER" ? "champion" : "eliminated";
  },
  champion(cup) {
    const f = cup.fixtures.find((x) => x.round === 7);
    return f && f.scoreH !== null ? winnersOf([f])[0] : null;
  },
  podium(cup) {
    const final = cup.fixtures.find((f) => f.round === 7);
    const third = cup.fixtures.find((f) => f.round === 6);
    if (!final || final.scoreH === null || !third || third.scoreH === null) return null;
    const fw = winnerOf({ scoreH: final.scoreH, scoreA: final.scoreA!, pensH: final.pensH, pensA: final.pensA });
    const tw = winnerOf({ scoreH: third.scoreH, scoreA: third.scoreA!, pensH: third.pensH, pensA: third.pensA });
    return [fw === "h" ? final.homeId : final.awayId, fw === "h" ? final.awayId : final.homeId, tw === "h" ? third.homeId : third.awayId];
  },
};
```

- [ ] **Step 4: Registrar e testar**

Em `registry.ts`: `import { g16 } from "./g16";` e `1954: g16, 1958: g16, 1962: g16, 1966: g16, 1970: g16,`.

Run: `npx jest formats/__tests__/g16.test.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/g16.ts lib/game/formats/__tests__/g16.test.ts lib/game/formats/registry.ts
git commit -m "feat(formats): g16 engine (1954–70, quartas direto)"
```

---

### Task 9: Motor finalGroup1950 (showcase Maracanazo)

**Files:**
- Create: `lib/game/formats/finalGroup1950.ts`
- Test: `lib/game/formats/__tests__/finalGroup1950.test.ts`

13 times em 4 grupos de tamanhos [4,4,3,2]. Cada grupo round-robin. Os 4 1ºs vão ao **grupo final** (round-robin, rounds 4–6). Campeão = 1º do grupo final. Sem semi/3º/final. Todos `knockout: false`.

- [ ] **Step 1: Teste falhando**

```ts
// lib/game/formats/__tests__/finalGroup1950.test.ts
import { finalGroup1950 } from "../finalGroup1950";
import { drawCup, advanceCup, currentRound, simulateRound } from "@/lib/game/cup";

describe("finalGroup1950", () => {
  it("13 times, 4 grupos [4,4,3,2], fixtures de grupo não-knockout", () => {
    const d = finalGroup1950.build({
      user: { name: "U", flag: "⭐", colors: ["#fff","#000"] }, seed: 1,
      rand: (() => { let a = 1; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })(),
      editionId: "brasil-1950",
    });
    expect(Object.keys(d.teams)).toHaveLength(13);
    expect(Object.keys(d.groups)).toHaveLength(4);
    const sizes = Object.values(d.groups).map((g) => g.length).sort();
    expect(sizes).toEqual([2, 3, 4, 4]);
    expect(d.fixtures.every((f) => !f.knockout)).toBe(true);
    expect(finalGroup1950.lastRound).toBe(6);
  });

  it("simula a copa inteira: cria grupo final e termina em campeão sem final clássica", () => {
    const cup = drawCup({ name: "U", flag: "⭐", colors: ["#fff","#000"] }, 4242, "brasil-1950", "fiel");
    let guard = 0;
    while (cup.phase !== "champion" && cup.phase !== "eliminated" && guard++ < 40) {
      const r = currentRound(cup);
      if (r <= finalGroup1950.lastRound) simulateRound(cup, r);
      advanceCup(cup);
    }
    expect(["champion","eliminated"]).toContain(cup.phase);
    expect(cup.fixtures.some((f) => f.round >= 4)).toBe(true);   // grupo final existe
    expect(finalGroup1950.champion(cup)).not.toBeNull();
  });
});
```

- [ ] **Step 2: Rodar — falha**

Run: `npx jest formats/__tests__/finalGroup1950.test.ts`
Expected: FAIL "Cannot find module '../finalGroup1950'"

- [ ] **Step 3: Implementar**

```ts
// lib/game/formats/finalGroup1950.ts
import { SQUADS, squadLabel } from "@/lib/data/squads";
import type { CupState, CupTeamRef, Fixture } from "@/lib/game/types";
import { groupTable } from "@/lib/game/cup";
import { pickOpponents, roundRobin, stadiumByKey } from "./shared";
import type { CupEngine, DrawContext, DrawResult } from "./types";

const GROUPS = ["A", "B", "C", "D"];
const SIZES: Record<string, number> = { A: 4, B: 4, C: 3, D: 2 }; // soma 13
const FINAL_GROUP = "F"; // pseudo-grupo da fase final
const LABELS: Record<number, string> = {
  1: "1ª Rodada", 2: "2ª Rodada", 3: "3ª Rodada",
  4: "Grupo Final · Rodada 1", 5: "Grupo Final · Rodada 2", 6: "Grupo Final · Rodada 3",
};

function groupRoundRobinFixtures(editionId: string, group: string, ids: string[], roundOffset = 0): Fixture[] {
  const out: Fixture[] = [];
  roundRobin(ids).forEach((pairs, ri) => {
    pairs.forEach(([h, a], pi) => {
      const id = `g${group}-r${ri + 1 + roundOffset}-${pi}`;
      out.push({
        id, round: ri + 1 + roundOffset, group,
        homeId: h, awayId: a, stadium: stadiumByKey(editionId, id),
        knockout: false, scoreH: null, scoreA: null,
      });
    });
  });
  return out;
}

export const finalGroup1950: CupEngine = {
  id: "finalGroup1950",
  teamCount: 13,
  lastRound: 6,
  roundLabel: (r) => LABELS[r] ?? `Rodada ${r}`,
  build(ctx: DrawContext): DrawResult {
    const rand = ctx.rand;
    const opponents = pickOpponents(SQUADS, rand, 12);
    const teams: Record<string, CupTeamRef> = {
      USER: { squadId: "USER", name: ctx.user.name, flag: ctx.user.flag, colors: ctx.user.colors },
    };
    for (const s of opponents) teams[s.id] = { squadId: s.id, name: squadLabel(s), flag: s.flag, colors: s.colors };
    const ids = ["USER", ...opponents.map((s) => s.id)].sort(() => rand() - 0.5);
    const groups: Record<string, string[]> = {};
    let cursor = 0;
    for (const g of GROUPS) { groups[g] = ids.slice(cursor, cursor + SIZES[g]); cursor += SIZES[g]; }
    const userGroup = GROUPS.find((g) => groups[g].includes("USER"))!;
    const fixtures = GROUPS.flatMap((g) => groupRoundRobinFixtures(ctx.editionId, g, groups[g]));
    return { teams, groups, userGroup, fixtures };
  },
  advance(cup) {
    const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
    if (groupsDone && !cup.fixtures.some((f) => f.round >= 4)) {
      // 1º de cada grupo → grupo final
      const finalists = GROUPS.map((g) => groupTable(cup, g)[0].teamId);
      cup.groups[FINAL_GROUP] = finalists;
      cup.fixtures.push(...groupRoundRobinFixtures(cup.editionId, FINAL_GROUP, finalists, 3));
      cup.phase = "finalGroup";
      return;
    }
    // grupo final terminou → define campeão
    const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
    if (fg.length > 0 && fg.every((f) => f.scoreH !== null)) {
      const champ = this.champion(cup);
      cup.phase = champ === "USER" ? "champion" : "eliminated";
    }
  },
  champion(cup) {
    const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
    if (fg.length === 0 || fg.some((f) => f.scoreH === null)) return null;
    return groupTable(cup, FINAL_GROUP)[0].teamId;
  },
  podium(cup) {
    const fg = cup.fixtures.filter((f) => f.group === FINAL_GROUP);
    if (fg.length === 0 || fg.some((f) => f.scoreH === null)) return null;
    const t = groupTable(cup, FINAL_GROUP);
    return [t[0].teamId, t[1].teamId, t[2]?.teamId ?? t[1].teamId];
  },
};
```

Nota: `groupTable(cup, FINAL_GROUP)` lê `cup.groups[FINAL_GROUP]` e os fixtures com `group === "F"` — funciona porque `groupTable` é genérico por `group`.

- [ ] **Step 4: Registrar e testar**

Em `registry.ts`: `import { finalGroup1950 } from "./finalGroup1950";` e `1950: finalGroup1950,`.

Run: `npx jest formats/__tests__/finalGroup1950.test.ts`
Expected: PASS (2)

- [ ] **Step 5: Commit**

```bash
git add lib/game/formats/finalGroup1950.ts lib/game/formats/__tests__/finalGroup1950.test.ts lib/game/formats/registry.ts
git commit -m "feat(formats): finalGroup1950 engine (grupo final / Maracanazo)"
```

---

### Task 10: Lore por edição (`editions.ts`)

**Files:**
- Modify: `lib/data/editions.ts`

- [ ] **Step 1: Adicionar `lore` em cada edição**

Adicionar a propriedade `lore` em cada objeto de `EDITIONS`. Textos pt-BR curtos e imersivos. Exemplos completos (escrever para TODAS as 21):

```ts
// brasil-1950
lore: "Aqui era assim: 4 grupos e um quadrangular final, sem decisão única. Foi onde nasceu o Maracanazo.",
// suica-1954
lore: "16 seleções, grupos e mata-mata a partir das quartas. A Copa dos gols: média recorde por jogo.",
// suecia-1958
lore: "16 seleções, 4 grupos e quartas direto. O mundo conheceu um garoto de 17 anos chamado Pelé.",
// chile-1962
lore: "16 seleções no formato clássico de grupos e quartas, nas montanhas do Chile.",
// inglaterra-1966
lore: "16 seleções, grupos e quartas. Em casa, os ingleses ergueram a taça pela única vez.",
// mexico-1970
lore: "16 seleções, quartas direto após os grupos. A Copa do tricampeonato e do melhor time de todos os tempos.",
// alemanha-1974
lore: "16 seleções com uma 2ª fase de grupos no lugar das oitavas — sem semifinal. (Modo Fiel em breve.)",
// argentina-1978
lore: "16 seleções e a 2ª fase de grupos que levava direto à final. (Modo Fiel em breve.)",
// espanha-1982
lore: "24 seleções: grupos, depois grupos de 3, e então o mata-mata. (Modo Fiel em breve.)",
// mexico-1986
lore: "24 seleções, 6 grupos e os melhores terceiros indo às oitavas. A Copa da mão de Maradona.",
// italia-1990
lore: "24 seleções no formato de 6 grupos com melhores terceiros. Noites mágicas italianas.",
// eua-1994
lore: "24 seleções, 6 grupos e melhores terceiros. A Copa decidida nos pênaltis pela primeira vez.",
// franca-1998
lore: "32 seleções pela primeira vez: 8 grupos e oitavas de final. O formato que virou padrão.",
// coreia-japao-2002
lore: "32 seleções em 8 grupos. A primeira Copa em dois países e em solo asiático.",
// alemanha-2006
lore: "32 seleções, 8 grupos e oitavas. Festa alemã e a despedida de Zidane.",
// africa-do-sul-2010
lore: "32 seleções, 8 grupos e oitavas, ao som das vuvuzelas.",
// brasil-2014
lore: "32 seleções, 8 grupos e oitavas. O Maracanã de volta ao centro do mundo.",
// russia-2018
lore: "32 seleções em 8 grupos. A última Copa antes da expansão para 48.",
// catar-2022
lore: "32 seleções, 8 grupos e oitavas. A primeira Copa no fim do ano, no deserto.",
// america-do-norte-2026
lore: "48 seleções pela primeira vez: 12 grupos e os 16 avos de final. A maior Copa da história.",
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep editions`
Expected: sem erros referentes a `editions.ts` (`lore` é opcional no tipo).

- [ ] **Step 3: Commit**

```bash
git add lib/data/editions.ts
git commit -m "feat(editions): mini-história (lore) por edição"
```

---

### Task 11: Store — persist v5, modo na carreira, newCareer(mode)

**Files:**
- Modify: `lib/game/store.ts`

- [ ] **Step 1: Adicionar `cupMode` ao estado e ao freshCareer**

Em `interface CareerState` (após `editionId`):
```ts
  cupMode: CupMode;          // modo escolhido para esta edição (fiel/tradicional)
```
Importar o tipo: no import de `./types` adicionar `CupMode`.
Em `freshCareer` (objeto inicial, ~linha 128), adicionar:
```ts
  cupMode: "tradicional" as CupMode,
```

- [ ] **Step 2: `newCareer` recebe `mode`**

Atualizar a assinatura na interface de actions (linha ~65):
```ts
  newCareer: (coachName: string, editionId: string, formation: FormationId, mode: CupMode, kit?: { kit1: [string, string]; kit2: [string, string]; pattern1?: string; pattern2?: string }) => void;
```
E a implementação (linha ~160):
```ts
      newCareer: (coachName, editionId, formation, mode, kit) =>
        set({
          ...freshCareer,
          coachName,
          careerMode: "legends",
          editionId,
          cupMode: mode,
          userColors: kit?.kit1 ?? USER_COLORS,
          userColors2: kit?.kit2 ?? USER_KIT2,
          userPattern: kit?.pattern1 ?? "solid",
          userPattern2: kit?.pattern2 ?? "solid",
          draftFormation: formation,
          slots: slotsForFormation(formation),
          tactics: { ...initialTactics, formation },
          lineupIds: FORMATIONS[formation].map(() => null),
        }),
```
Em `newCareer2026`, adicionar `cupMode: "tradicional"` no `set({...})`.

- [ ] **Step 3: `startCup` passa o modo**

Atualizar `startCup` (linha ~293):
```ts
      startCup: () => {
        const s = get();
        const cup = drawCup(
          { name: userTeamName(s), flag: "⭐", colors: s.userColors ?? USER_COLORS },
          Math.floor(Math.random() * 2 ** 31),
          s.editionId,
          s.cupMode,
        );
        set({ cup });
      },
```

- [ ] **Step 4: `recordResult` usa `lastRound(cup)`**

No import de `./cup` (linha 9), trocar `LAST_ROUND` por `lastRound`. No loop de `recordResult` (linha ~346), trocar:
```ts
            if (r > lastRound(cup)) { advanceCup(cup); break; }
```

- [ ] **Step 5: Persist v5 + migração**

Atualizar (linha ~370):
```ts
      name: "futbattle-career",
      version: 5,
      migrate: (persisted, version) => {
        if (version < 3) return { ...freshCareer } as CareerState;
        const p = persisted as Record<string, unknown>;
        // v3→v4: squadName cosmético
        const withName = { squadName: "", cupMode: "tradicional", ...p } as Record<string, unknown>;
        // v4→v5: cups antigos viram Tradicional; fixtures sem knockout derivam round>=4
        const cup = withName.cup as { mode?: string; fixtures?: Array<Record<string, unknown>> } | null;
        if (cup) {
          if (!cup.mode) cup.mode = "tradicional";
          if (cup.fixtures) for (const f of cup.fixtures) {
            if (f.knockout === undefined) f.knockout = (f.round as number) >= 4;
          }
        }
        return withName as unknown as CareerState;
      },
```

- [ ] **Step 6: Type-check + testes**

Run: `npx tsc --noEmit` (UI ainda com erros de ROUND_LABEL — ok) e `npx jest`
Expected: testes de motor/formats PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/game/store.ts
git commit -m "feat(store): persist v5, cupMode na carreira, newCareer(mode), startCup passa o modo"
```

---

### Task 12: Home — popup Fiel/Tradicional + retângulo de aviso + "?"

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Importar helpers e ajustar `pickEdition`**

No topo de `app/page.tsx`, adicionar imports:
```ts
import { fielAvailable } from "@/lib/game/formats/registry";
import type { CupMode } from "@/lib/game/types";
import { IconStadium } from "@/components/icons"; // se ainda não importado
```
Adicionar estado do popup (junto aos outros `useState`):
```ts
const [pickedEd, setPickedEd] = useState<string | null>(null);
```
Trocar `pickEdition` para apenas abrir o popup:
```ts
function openEdition(editionId: string) { setPickedEd(editionId); }
function startWithMode(editionId: string, mode: CupMode) {
  career.newCareer(name.trim() || "Mister", editionId, "4-2-3-1", mode, {
    kit1, kit2, pattern1: pat1, pattern2: pat2,
  });
  router.push("/squad");
}
```

- [ ] **Step 2: Retângulo de aviso fixo na etapa de edição**

No bloco `step === "edition"`, trocar o parágrafo explicativo atual por um layout com o aviso ao lado da grade. Substituir o `<p>` (linhas ~391–394) e envolver a grade:
```tsx
<div className="flex flex-col sm:flex-row gap-3 mt-2">
  <div className="sm:w-44 shrink-0 arc-mini p-3 self-start">
    <div className="font-arc text-[10px] font-extrabold uppercase tracking-widest text-[var(--gold)] mb-1">Dica do mister</div>
    <p className="font-arc text-[11px] font-semibold leading-snug text-[var(--ink)] opacity-80">
      Cada Copa tem regras próprias. Ao escolher, decida: <b>Fiel</b> (o formato real daquele ano)
      ou <b>Tradicional</b> (o formato de hoje, 48 seleções, com o estádio e o clima da época).
    </p>
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[44vh] overflow-y-auto pr-1 flex-1">
    {EDITIONS.map((e) => (
      <button key={e.id} data-sound="confirm" onClick={() => openEdition(e.id)}
        className="rounded-2xl border-[3px] border-[var(--ink)] bg-white p-3 text-left shadow-[3px_4px_0_var(--ink)] hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--ink)] active:translate-y-1 active:shadow-[1px_2px_0_var(--ink)] transition-all">
        <div className="text-2xl mb-1">{e.flag}</div>
        <div className="font-display text-base leading-tight text-[var(--ink)]">{editionLabel(e)}</div>
        <div className="font-arc text-[10px] font-bold opacity-55 text-[var(--ink)] flex items-center gap-1 mt-1">
          <IconStadium size={12} /> {e.stadiums.length} estádios
        </div>
      </button>
    ))}
  </div>
</div>
```

- [ ] **Step 3: Popup de modo (com "?" lore)**

Antes do fechamento do `<main>`, adicionar o modal. Usa `EDITION_BY_ID` (importar de `@/lib/data/editions`) para ler `lore` e `editionLabel`:
```tsx
<AnimatePresence>
  {pickedEd && (() => {
    const ed = EDITION_BY_ID[pickedEd];
    const fiel = fielAvailable(pickedEd);
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70" onClick={() => setPickedEd(null)}>
        <motion.div initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
          className="arc-panel p-5 sm:p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <div className="text-3xl mb-1">{ed.flag}</div>
          <h3 className="font-display text-2xl text-[var(--ink)]">{editionLabel(ed)}</h3>
          {ed.lore && (
            <div className="arc-mini p-3 my-3 flex gap-2">
              <span className="font-display text-lg text-[var(--gold)] shrink-0">?</span>
              <p className="font-arc text-[11px] font-semibold leading-snug text-[var(--ink)] opacity-80">{ed.lore}</p>
            </div>
          )}
          <div className="flex flex-col gap-2 mt-2">
            <button data-sound="confirm" disabled={!fiel} onClick={() => startWithMode(pickedEd, "fiel")}
              className={`arc-btn arc-btn--lima w-full py-3 ${fiel ? "" : "opacity-40 pointer-events-none"}`}>
              <span className="block font-display text-lg">JOGAR FIEL</span>
              <span className="block font-arc text-[10px] font-bold opacity-75">{fiel ? "o formato real daquela Copa" : "Modo Fiel em breve nesta Copa"}</span>
            </button>
            <button data-sound="confirm" onClick={() => startWithMode(pickedEd, "tradicional")}
              className="arc-btn arc-btn--ciano w-full py-3">
              <span className="block font-display text-lg">JOGAR TRADICIONAL</span>
              <span className="block font-arc text-[10px] font-bold opacity-75">formato de hoje (48 times) com o tema de {ed.year}</span>
            </button>
            <button data-sound="cancel" onClick={() => setPickedEd(null)} className="arc-btn arc-btn--paper w-full py-2 text-sm mt-1">Voltar</button>
          </div>
        </motion.div>
      </motion.div>
    );
  })()}
</AnimatePresence>
```
Garantir imports: `EDITION_BY_ID` de `@/lib/data/editions`, `AnimatePresence`/`motion` de `framer-motion` (já usados na página).

- [ ] **Step 4: Type-check + smoke**

Run: `npx tsc --noEmit 2>&1 | grep "app/page"`
Expected: sem erros em `app/page.tsx`.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): popup Fiel/Tradicional + aviso de formato + lore por edição"
```

---

### Task 13: Cup page — derivar grupos/rounds, roundLabel, 3ºs condicional, bracket genérico

**Files:**
- Modify: `app/cup/page.tsx`

- [ ] **Step 1: Imports e derivação**

Trocar import `ROUND_LABEL` por `roundLabel`; manter `podium`, `groupTable`, `thirdPlaceTable`, `nextUserFixture`, `leaders`. Adicionar `engineFor` de `@/lib/game/formats/registry`.
No componente que tem `cup`, derivar:
```ts
const groupNames = Object.keys(cup.groups).filter((g) => g !== "F").sort();
const engine = engineFor(cup.mode, cup.editionId);
const usesThirds = engine.id === "g24" || engine.id === "g48";
const isFinalGroup = engine.id === "finalGroup1950";
```

- [ ] **Step 2: Substituir usos de `ROUND_LABEL[...]` por `roundLabel(cup, ...)`**

Linhas com `ROUND_LABEL[next.round]`, `ROUND_LABEL[detail.round]`, `ROUND_LABEL[r]` → `roundLabel(cup, next.round)` etc.

- [ ] **Step 3: Grupos derivados de `groupNames`**

Trocar `GROUP_NAMES.map((g) => ...)` (linha ~230) por `groupNames.map((g) => ...)`. Remover import de `GROUP_NAMES` se não usado em outro ponto.

- [ ] **Step 4: Ranking de 3ºs condicional + nota do grupo**

Envolver o bloco "Ranking dos terceiros colocados" (a partir de `{groupsDone && (`) com `{groupsDone && usesThirds && (`. A nota fixa "1º e 2º avançam · 3º disputa…" (linha ~289) trocar por texto dependente do motor:
```tsx
<p className="text-[10px] text-[var(--muted)] mt-2">
  {usesThirds ? "1º e 2º avançam · melhores 3ºs completam o mata-mata."
   : isFinalGroup ? "O 1º de cada grupo vai ao quadrangular final."
   : "1º e 2º de cada grupo avançam ao mata-mata."}
</p>
```

- [ ] **Step 5: Bracket genérico**

No `BracketTab` (linha ~365), trocar a lógica fixa por derivação dos rounds de mata-mata presentes. Para `finalGroup1950`, mostrar a tabela do grupo final em vez de chaveamento:
```tsx
function BracketTab({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const engine = engineFor(cup.mode, cup.editionId);
  if (engine.id === "finalGroup1950") {
    const fg = cup.groups["F"];
    if (!fg) return <div className="arc-panel p-10 text-center font-arc font-bold text-[rgba(20,21,18,0.6)]">O quadrangular final aparece quando a 1ª fase terminar.</div>;
    return (
      <div className="arc-panel p-4">
        <h4 className="font-display text-lg mb-2">Grupo Final</h4>
        <GroupTable cup={cup} group="F" />
        <p className="text-[10px] text-[var(--muted)] mt-2">Campeão = líder do quadrangular. Sem final única — é o Maracanazo.</p>
      </div>
    );
  }
  const koRounds = [...new Set(cup.fixtures.filter((f) => f.knockout).map((f) => f.round))].sort((a, b) => a - b);
  if (koRounds.length === 0) {
    return <div className="arc-panel p-10 text-center font-arc font-bold text-[rgba(20,21,18,0.6)]">O chaveamento aparece quando a fase de grupos terminar.</div>;
  }
  const fs = (round: number) => cup.fixtures.filter((f) => f.round === round).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return (
    <div className="arc-panel p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-max">
        {koRounds.map((r) => (
          <div key={r} className="flex flex-col justify-around gap-2 min-w-[150px]">
            <div className="font-arc text-[9px] uppercase tracking-wider text-white/80 font-extrabold text-center">{roundLabel(cup, r)}</div>
            {fs(r).map((f) => <Tie key={f.id} cup={cup} f={f} onFixture={onFixture} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
```
Extrair `Tie` e `GroupTable` como componentes reutilizáveis (mover a função `Tie` interna existente para o escopo do módulo, recebendo `cup`/`onFixture` por props; reusar a tabela de grupo já renderizada na aba de grupos como componente `GroupTable`). Se a refatoração de `GroupTable` for grande, criar um componente mínimo que renderiza `groupTable(cup, group)` no mesmo estilo da aba de grupos.

- [ ] **Step 6: "?" lore no topo da copa**

Logo abaixo do cabeçalho da página de copa, adicionar (lendo `EDITION_BY_ID[cup.editionId].lore`):
```tsx
{EDITION_BY_ID[cup.editionId]?.lore && (
  <div className="arc-mini p-2.5 mb-3 flex gap-2 items-start">
    <span className="font-display text-base text-[var(--gold)] shrink-0">?</span>
    <p className="font-arc text-[11px] font-semibold leading-snug opacity-80">{EDITION_BY_ID[cup.editionId].lore}</p>
  </div>
)}
```
Importar `EDITION_BY_ID` de `@/lib/data/editions`.

- [ ] **Step 7: Type-check + build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: sem erros; `/cup` compila.

- [ ] **Step 8: Commit**

```bash
git add app/cup/page.tsx
git commit -m "feat(cup): grupos/rounds derivados do formato, bracket genérico, grupo final 1950, lore"
```

---

### Task 14: Match page — roundLabel + knockout flag

**Files:**
- Modify: `app/match/page.tsx`

- [ ] **Step 1: Trocar ROUND_LABEL e round>=4**

No import (linha 16), trocar `ROUND_LABEL` por `roundLabel`.
Linha 156: `createMatch(home, away, pre.seed, pre.f.knockout, coolingBreaks)`.
Linhas com `ROUND_LABEL[f.round]` / `ROUND_LABEL[meta.round]` → `roundLabel(c.cup!, f.round)` / `roundLabel(c.cup!, meta.round)`. (O componente tem acesso a `c.cup`; onde só houver `meta`, passar `cup` via prop ou usar `useCareer().cup`.)
Linha 935 (`others` clustering): `const k = f.group ? ... : roundLabel(c.cup!, f.round);`.

- [ ] **Step 2: Type-check + build**

Run: `npx tsc --noEmit && npm run build 2>&1 | tail -5`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add app/match/page.tsx
git commit -m "feat(match): roundLabel por formato + flag knockout no fixture"
```

---

### Task 15: Integração final + verificação manual

**Files:** nenhum (verificação)

- [ ] **Step 1: Suite completa**

Run: `npm test`
Expected: tudo verde (motor/calibração intactos + novos testes de formats).

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: compila sem erros.

- [ ] **Step 3: Smoke manual (dev + browser)**

Run: `npm run dev` e, com o helper `scripts/gen-verify-state.ts` (ou jogando do início):
- Home → escolher **1950** → popup aparece, "?" mostra Maracanazo, **JOGAR FIEL** → conferir 4 grupos [4,4,3,2], depois o **Grupo Final** na aba chaveamento, campeão pelo quadrangular.
- Home → escolher **2026** → **JOGAR TRADICIONAL** → idêntico ao atual (48 times).
- Home → escolher **1974** → no popup, **JOGAR FIEL** desabilitado ("em breve"); Tradicional funciona.
- Conferir retângulo "Dica do mister" ao lado da grade de edições.

- [ ] **Step 4: Atualizar CLAUDE.md**

Acrescentar em `## Arquitetura` a pasta `lib/game/formats/` e, em `### Copa`, nota: "Formato por edição: `mode` (fiel/tradicional) + `editionId` → motor em `formats/registry.ts`. Tradicional = g48 sempre; Fiel = formato do ano (1974/78/1982 travados até a Fase 2). `Fixture.knockout` define mata-mata; `roundLabel(cup,r)`/`lastRound(cup)` delegam ao motor."

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: formatos de copa por edição (modo Fiel/Tradicional)"
```

---

## Self-review

- **Cobertura do spec:** modo Tradicional=g48 (T4/T5) ✓; Fiel por ano (T6 g32, T7 g24, T8 g16, T9 1950) ✓; 74/78/82 travados (registry FIEL_LOCKED_YEARS + UI disabled, T5/T12) ✓; Fixture.knockout (T1, usado T5/T14) ✓; popup + retângulo + "?" (T12) ✓; lore (T10) ✓; cup page derivada + grupo final + 3ºs condicional (T13) ✓; persist v5 + migração (T11) ✓; testes determinismo/campeão por motor (T4/6/7/8/9) ✓.
- **Placeholders:** lore tem exemplos completos para as 21 edições (T10) — sem TODO. Bracket `GroupTable`/`Tie` extraídos com instrução concreta (T13 Step 5).
- **Consistência de tipos:** `CupEngine` (id, teamCount, lastRound, build, advance, roundLabel, champion, podium) idêntico em todos os motores; `buildGroups`/`groupFixtures`/`winnersOf` exportados de g48 e reusados por g16/g24/g32; `engineFor`/`fielAvailable` assinaturas constantes; `drawCup(user, seed, editionId, mode)` e `newCareer(coachName, editionId, formation, mode, kit?)` consistentes entre store e home.
- **Gap conhecido (aceito):** `finalGroup1950.advance` usa `this.champion` — garantir que o objeto seja chamado como método (é; `engineFor` retorna o objeto e `advance` é invocado como `engine.advance(cup)`, mas `this` dentro de `advance` exige chamada via `engine.advance`). Em `cup.ts`, `advanceCup` faz `engineFor(...).advance(cup)` → `this` correto. ✓
