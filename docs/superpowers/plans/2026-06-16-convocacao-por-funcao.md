# Convocação por função — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Desacoplar o draft da formação — montar elenco por cota de função (19), formação+XI só na prancheta — com tela cheia cinematográfica. Mata o bug do `setDraftFormation` reshuffle.

**Architecture:** Nova camada de dados (`Role`, `POSITION_ROLE`, `ROLE_QUOTA`). Store passa de slots-de-formação pra slots-de-função (19). `completeDraft` deriva XI/banco do pool. DraftView vira tela full-bleed (board + prévia em mini-campo + reel da seleção sorteada) com animações framer-motion. Engine/copa/prancheta intactos.

**Tech Stack:** Next.js, zustand+persist, framer-motion, TypeScript, Jest.

Spec: `docs/superpowers/specs/2026-06-16-convocacao-por-funcao-design.md`. Mockup aprovado: `.superpowers/brainstorm/71174-1781639093/content/convocacao-wow.html`.

---

## File Structure
- `lib/game/types.ts` — add `Role`, `POSITION_ROLE`, `ROLE_SHORT`.
- `lib/game/draftQuota.ts` (novo) — `ROLE_QUOTA` (19 slots ordenados) + helpers `roleOf(pos)`, `rolesOfCard(card)`.
- `lib/game/store.ts` — `DraftSlot = {role,reserve,card}`; quota fixa; `fillSlot` por função; remove `setDraftFormation` do draft; `completeDraft` rederiva; version bump + migrate.
- `app/squad/page.tsx` — DraftView reescrita (board+prévia+reel+animação).
- Testes: `lib/game/__tests__/draftQuota.test.ts`, casos no `game.test.ts`.

---

## Phase 1 — Dados de função (TDD)

### Task 1: Role + POSITION_ROLE em types.ts
**Files:** Modify `lib/game/types.ts` · Test `lib/game/__tests__/draftQuota.test.ts`

- [ ] **Step 1: Failing test**
```ts
// lib/game/__tests__/draftQuota.test.ts
import { POSITION_ROLE, ROLE_SHORT } from "@/lib/game/types";
import { ROLE_QUOTA, roleOf, rolesOfCard } from "@/lib/game/draftQuota";
import type { Position } from "@/lib/game/types";

const ALL_POS: Position[] = ["GK","RB","CB","LB","DM","CM","AM","RW","LW","ST"];

describe("POSITION_ROLE", () => {
  it("mapeia todo Position pra exatamente 1 Role", () => {
    for (const p of ALL_POS) expect(POSITION_ROLE[p]).toBeDefined();
    expect(POSITION_ROLE.GK).toBe("GOL");
    expect(POSITION_ROLE.CB).toBe("ZAG");
    expect(POSITION_ROLE.RB).toBe("LAT");
    expect(POSITION_ROLE.LB).toBe("LAT");
    expect(POSITION_ROLE.DM).toBe("VOL");
    expect(POSITION_ROLE.CM).toBe("MEI");
    expect(POSITION_ROLE.AM).toBe("MEI");
    expect(POSITION_ROLE.RW).toBe("ATA");
    expect(POSITION_ROLE.ST).toBe("ATA");
  });
  it("ROLE_SHORT cobre as 6 funções", () => {
    expect(Object.keys(ROLE_SHORT).sort()).toEqual(["ATA","GOL","LAT","MEI","VOL","ZAG"]);
  });
});
```
- [ ] **Step 2: Run** `npx jest draftQuota` → FAIL (modules/exports faltando).
- [ ] **Step 3: Implementar em `lib/game/types.ts`** (após `POSITION_SECTOR`):
```ts
export type Role = "GOL" | "ZAG" | "LAT" | "VOL" | "MEI" | "ATA";

export const POSITION_ROLE: Record<Position, Role> = {
  GK: "GOL",
  CB: "ZAG",
  RB: "LAT", LB: "LAT",
  DM: "VOL",
  CM: "MEI", AM: "MEI",
  RW: "ATA", LW: "ATA", ST: "ATA",
};

export const ROLE_SHORT: Record<Role, string> = {
  GOL: "GOL", ZAG: "ZAG", LAT: "LAT", VOL: "VOL", MEI: "MEI", ATA: "ATA",
};
```
(Task 2 cria draftQuota.ts; rode o jest só depois da Task 2.)

### Task 2: ROLE_QUOTA + helpers (draftQuota.ts)
**Files:** Create `lib/game/draftQuota.ts`

- [ ] **Step 1: Implementar**
```ts
// lib/game/draftQuota.ts
import type { Card, Position, Role } from "./types";
import { POSITION_ROLE } from "./types";

export interface QuotaSlot { role: Role; reserve: boolean }

// 19 convocados: por função N titulares + 1 reserva. Ordem = ordem visual do quadro.
const SPEC: [Role, number][] = [
  ["GOL", 1], ["ZAG", 2], ["LAT", 2], ["VOL", 2], ["MEI", 3], ["ATA", 3],
];
export const ROLE_QUOTA: QuotaSlot[] = SPEC.flatMap(([role, n]) => [
  ...Array.from({ length: n }, () => ({ role, reserve: false })),
  { role, reserve: true },
]);

export const SQUAD_SIZE = ROLE_QUOTA.length; // 19

export function roleOf(pos: Position): Role { return POSITION_ROLE[pos]; }
export function rolesOfCard(card: Card): Role[] {
  return [...new Set(card.player.positions.map((p) => POSITION_ROLE[p]))];
}
```
- [ ] **Step 2: Test extra** (append no draftQuota.test.ts):
```ts
describe("ROLE_QUOTA", () => {
  it("soma 19 (13 titulares + 6 reservas)", () => {
    expect(ROLE_QUOTA.length).toBe(19);
    expect(ROLE_QUOTA.filter((q) => !q.reserve).length).toBe(13);
    expect(ROLE_QUOTA.filter((q) => q.reserve).length).toBe(6);
  });
  it("roleOf/rolesOfCard", () => {
    expect(roleOf("ST")).toBe("ATA");
    const card = { player: { positions: ["RB","LB"] } } as any;
    expect(rolesOfCard(card)).toEqual(["LAT"]);
  });
});
```
- [ ] **Step 3: Run** `npx jest draftQuota` → PASS.
- [ ] **Step 4: Commit** `feat(draft): Role + POSITION_ROLE + ROLE_QUOTA (19 por função)`.

---

## Phase 2 — Store por função (TDD onde dá)

### Task 3: DraftSlot por função + quota inicial
**Files:** Modify `lib/game/store.ts`

- [ ] **Step 1:** Trocar o tipo do slot e a inicialização.
  - `DraftSlot` (onde é declarado): `{ role: Role; reserve: boolean; card: Card | null }`.
  - Remover `benchSlots`/`emptyBench` do draft (reservas viram slots `reserve:true`).
  - `slotsForFormation` → **deletar**; criar:
```ts
import { ROLE_QUOTA } from "./draftQuota";
function freshDraftSlots(): DraftSlot[] {
  return ROLE_QUOTA.map((q) => ({ role: q.role, reserve: q.reserve, card: null }));
}
```
  - `freshCareer.slots = freshDraftSlots()`; remover `benchSlots`, `draftFormation` do estado de draft (formação default vai pra tactics só no completeDraft).
  - `allCards` passa a ler só `state.slots`.
- [ ] **Step 2:** Ajustar ações:
  - Remover `setDraftFormation` da interface e da store (formação não existe no draft).
  - `fillSlot(index, card)`: grava no slot index (validação de função fica na UI, que só acende vagas compatíveis). Mantém `morale[id]=70`.
  - Remover `fillBench` (reservas são slots normais agora).
- [ ] **Step 3:** `completeDraft` rederiva XI/banco:
```ts
import { assignLineup } from "./formations";
completeDraft: () => set((s) => {
  const titulares = s.slots.filter((x) => !x.reserve).map((x) => x.card).filter((c): c is Card => !!c);
  const reservas  = s.slots.filter((x) =>  x.reserve).map((x) => x.card).filter((c): c is Card => !!c);
  const f = s.tactics.formation; // default 4-2-3-1
  const xi = assignLineup(titulares, f);          // 11 melhores encaixados
  const xiIds = new Set(xi.filter(Boolean).map((c) => c!.player.id));
  const bench = [...titulares.filter((c) => !xiIds.has(c.player.id)), ...reservas];
  return {
    draftDone: true,
    lineupIds: xi.map((c) => c?.player.id ?? null),
    benchIds: bench.map((c) => c.player.id),
  };
}),
```
- [ ] **Step 4:** Version bump do persist (+1) e `migrate`: saves antigos (com `benchSlots`/`draftFormation`) → descartar pro estado fresco (segue padrão CLAUDE.md). 
- [ ] **Step 5:** `npx tsc --noEmit` → corrigir todos os usos de `benchSlots`/`fillBench`/`setDraftFormation` que o type-check apontar (DraftView, ManageView usam `swapWithBench` que continua via `benchIds`).
- [ ] **Step 6: Test** (game.test.ts): montar 19 cards reais nos slots, `completeDraft`, assert `lineupIds` tem 11 não-nulos e todos ids existem; `benchIds` = resto. Run `npx jest game`.
- [ ] **Step 7: Commit** `refactor(store): draft por função (19), completeDraft rederiva XI/banco`.

---

## Phase 3 — Tela de convocação (build, ref. mockup)

### Task 4: Estrutura da tela (board + prévia + reel)
**Files:** Modify `app/squad/page.tsx` (DraftView)

- [ ] **Step 1:** Reescrever DraftView pra layout grid (header / main[board|prévia] / reel), portando o HTML/CSS do mockup `convocacao-wow.html` pra JSX + classes `arc-*`/inline. Estado: `picked` (carta do reel selecionada), derivar vagas que acendem por `rolesOfCard(picked)` ∩ slots vazios.
- [ ] **Step 2:** Board: `ROLE_QUOTA` agrupado por função → linhas. Chip preenchido mostra **posição real** `POSITION_SHORT[card.player.positions[0]]` (PD/CA/VOL…), OVR, bandeira, nome; borda por `POSITION_SECTOR`; glow se `effectiveOvr>=95`. Vaga vazia: tracejado com `ROLE_SHORT[role]` (+ "res" se reserva). Clicar carta→clicar vaga compatível chama `fillSlot`.
- [ ] **Step 3:** Prévia: reusar `Pitch` + dots por `POSITION_SECTOR`/posição; medidores via `sectorOvr` + Força via média `effectiveOvr` (reusar helpers de squad ManageView). Contador `n/19`.
- [ ] **Step 4:** Reel: cartas da seleção sorteada (`draftDraw`/`drawSquad`) com `KitJersey`/cores; clique seleciona (`picked`). Botão DADO chama o fluxo de sorteio atual (reusar `setDraftDraw`/economia `spendReroll`/`rerollsLeft`).
- [ ] **Step 5:** `npx tsc --noEmit` + `npm run build` → verde.
- [ ] **Step 6: Commit** `feat(squad): tela de convocação por função (board+prévia+reel)`.

### Task 5: Animação + polish
- [ ] **Step 1:** framer-motion: ao `fillSlot`, carta voa do reel pro slot (layout/transform), carimbo "CONVOCADO" (scale+rotate fade), dot pop no campo, Força/medidor sobem. Sons `data-sound="dice|stamp|reveal"` (já existem).
- [ ] **Step 2:** Fundo full-bleed: noite de estádio (radiais refletor, vinheta, halftone, grafismo diagonal) — portar do mockup, dentro da identidade `arc-*` (sem roxo/neon).
- [ ] **Step 3:** `npm run build` + auditoria mobile (1 coluna: board em cima, prévia/reel abaixo; `safe-*`).
- [ ] **Step 4: Commit** `feat(squad): animação cinematográfica da convocação`.

---

## Phase 4 — Verificação
- [ ] `npm test` (engine/copa/fuzz intactos; novos testes verdes).
- [ ] `npm run build` verde.
- [ ] Manual: sortear → convocar 19 → ver posições reais (PD/CA…) no board → completar → prancheta escolhe formação e os 11 saem do pool. Trocar formação na prancheta NÃO reembaralha (bug morto).

## Self-review (coberto)
- Spec: cota 19 ✓ (Task 2), mapa função ✓ (Task 1), posição real no chip ✓ (Task 4.2), formação só na prancheta ✓ (Task 3 remove setDraftFormation), prévia/Força ✓ (Task 4.3), animação ✓ (Task 5), version/migrate ✓ (Task 3.4), testes ✓ (Phase 4).
- Sem placeholders nos passos de lógica; UI referencia mockup concreto.
- Tipos consistentes: `Role`/`POSITION_ROLE` (types.ts) usados por draftQuota + store + DraftView.
