# Formato de torneio por edição da Copa — design

Date: 2026-06-12 · Branch sugerida: `feat/edition-formats`

## Objetivo

Cada edição da Copa pode ser jogada em dois modos, escolhidos pelo usuário ao
selecionar a edição:

- **Tradicional** — o formato FIFA de hoje (48 times, 12 grupos, R32→Final), com o
  estádio e a temática visual daquele ano. Reaproveita 100% do motor de copa atual.
- **Fiel** — o formato REAL daquela Copa ("como era de verdade"): número de times,
  layout de grupos e chaveamento históricos. Os **times** são sorteados do pool
  inteiro de squads (como hoje) — só o número e a estrutura mudam, não os
  participantes reais.

Mais: dois avisos na tela de escolha (um retângulo fixo explicando o conceito + um
popup ao escolher cada Copa perguntando o modo) e um "?" com mini-história imersiva
por edição.

## Não-objetivos

- Não adicionar os elencos reais de cada Copa ao dataset (trabalho de dados à parte).
- Não mudar `engine.ts` (motor de partida), calibração de gols, nem o sorteio do draft.
- Fase 1 não implementa 1974/78/1982 no modo Fiel (ver Fases).

## Fases

- **Fase 1 (este plano):** toggle de modo + 2 avisos + "?" lore + motores
  `g16ko` (1954–70), `g24ko` (1986–94), `g32ko` (1998–2022), `g48ko` (2026, refactor
  do atual sem mudança de comportamento) e `finalGroup1950` (showcase Maracanazo).
  No modo Fiel, as edições **1974, 1978 e 1982 ficam travadas** ("Modo Fiel em breve
  nesta Copa" no popup; Tradicional disponível normalmente).
- **Fase 2 (plano futuro):** motores `secondGroup1974` (74/78) e `groups1982`.

## Os 7 motores de formato (mapa ano→motor no modo Fiel)

| Motor | Edições | Estrutura real |
|---|---|---|
| `finalGroup1950` | 1950 | 13 times, 4 grupos [4,4,3,2] → **quadrangular final** (4 vencedores, round-robin). Campeão = 1º do grupo final. Sem semi/3º/final. |
| `g16ko` | 1954,58,62,66,70 | 16 times, 4 grupos de 4 → Quartas → Semi → 3º → Final. |
| `secondGroup1974` (Fase 2) | 1974,78 | 16 times, 4 grupos → **2 grupos de 4** → vencedores à Final, vices ao 3º. Sem semi. |
| `groups1982` (Fase 2) | 1982 | 24 times, 6 grupos de 4 → **4 grupos de 3** → Semi → 3º → Final. |
| `g24ko` | 1986,90,94 | 24 times, 6 grupos de 4, top 2 + **4 melhores 3ºs** (16) → Oitavas → Quartas → Semi → 3º → Final. |
| `g32ko` | 1998–2022 | 32 times, 8 grupos de 4 → Oitavas → Quartas → Semi → 3º → Final. |
| `g48ko` | 2026 (e TODO modo Tradicional) | 48 times, 12 grupos, top2 + 8 melhores 3ºs → R32 → … → Final. |

Numeração de rounds por motor (round → label), com `lastRound`:

- `finalGroup1950`: 1–3 = grupos (round-robin, tamanho variável); 4–6 = grupo final;
  `lastRound = 6`. Todos `knockout: false`.
- `g16ko`: 1–3 grupos; 4 = Quartas; 5 = Semi; 6 = 3º; 7 = Final. `lastRound = 7`.
- `g24ko` / `g32ko`: 1–3 grupos; 4 = Oitavas; 5 = Quartas; 6 = Semi; 7 = 3º; 8 = Final. `lastRound = 8`.
- `g48ko`: 1–3 grupos; 4 = R32; 5 = R16; 6 = Quartas; 7 = Semi; 8 = 3º; 9 = Final. `lastRound = 9` (igual ao atual).

Como o número/round não tem significado universal, `roundLabel` é por motor.

## Modelo de dados (`lib/game/types.ts`)

```ts
export type CupMode = "fiel" | "tradicional";

// CupState ganha:
//   mode: CupMode;
// Fixture ganha:
//   knockout: boolean;   // set no build; substitui "round >= 4"
// CupPhase ganha: "finalGroup" | "secondGroup"
```

`mode` + `editionId` determinam o motor; nada mais precisa ser persistido (engine é
derivável). `knockout` no fixture resolve penalties/empate por jogo sem depender do
número do round (essencial pro grupo-final de 1950, que é round-robin).

## Interface de motor + registry (`lib/game/formats/`)

```ts
// lib/game/formats/types.ts
export interface DrawContext {
  user: { name: string; flag: string; colors: [string, string] };
  rand: () => number;
  pickTeams: (n: number) => SquadDef[];  // sorteia n-1 adversários do pool
}

export interface CupEngine {
  id: string;
  teamCount: number;
  groupNames: string[];
  lastRound: number;
  build(ctx: DrawContext): { groups: Record<string,string[]>; userGroup: string; fixtures: Fixture[] };
  advance(cup: CupState): void;             // constrói próxima fase + seta cup.phase
  roundLabel(round: number): string;
  champion(cup: CupState): string | null;   // null enquanto indefinido
  podium(cup: CupState): [string,string,string] | null;  // 1950 retorna [campeão, vice, 3º] do grupo final
}

// lib/game/formats/registry.ts
export function engineFor(mode: CupMode, editionId: string): CupEngine;
//   tradicional → g48 sempre; fiel → ano(editionId)→motor; Fase 1: 74/78/1982 fiel → throw/locked
export function fielAvailable(editionId: string): boolean; // false p/ 74/78/1982 na Fase 1
```

Helpers compartilhados em `lib/game/formats/shared.ts`:
- `roundRobin(ids: string[]): [string,string][][]` — método do círculo, suporta
  tamanho ímpar (bye). Usado por grupos de tamanho variável (1950) e grupo final.
- `buildKnockout(cup, qualifiers: string[], round: number, knockout: boolean): void` —
  pareia em ordem de chave e cria fixtures com estádio (reusa `koStadium`).
- `groupRoundRobinFixtures(cup, group, ids)` — fixtures de um grupo (reusa `stadiumFor`).

## Refactor de `cup.ts` (mantém genérico, delega o resto)

Permanecem genéricos (operam sobre fixtures/grupos): `buildAiTeam`, `groupTable`,
`currentRound`, `userFixture`, `nextUserFixture`, `fixtureSeed`, `leaders`,
`accumulateTotals`, `recordUserResult`, `simulateRound`.

Mudam:
- `drawCup(user, seed, editionId, mode)` → escolhe motor, sorteia times via
  `pickTeams`, chama `engine.build`. (assinatura ganha `mode`.)
- `advanceCup(cup)` → `engineFor(cup.mode, cup.editionId).advance(cup)`.
- `ROUND_LABEL` estático → `roundLabel(cup, round)` (delega ao motor). `LAST_ROUND`
  constante → `lastRound(cup)`.
- `podium(cup)` / champion → delegam ao motor.
- `simulateRound` e qualquer `round >= 4` → usa `f.knockout`.
- `thirdPlaceTable`/`r32Qualifiers` → ficam no motor g48 (e g24 tem sua variante de 3ºs).

## UI

- **`app/page.tsx` (escolha de edição):**
  - Retângulo fixo ("aviso ambiente"): card `arc-mini` ao lado da grade de edições
    explicando "cada Copa tem regras próprias — escolha Fiel (como era) ou Tradicional
    (formato de hoje, com o tema do ano)".
  - **Popup ao clicar numa edição** (`arc-panel` modal): título com bandeira+ano,
    resumo do formato fiel daquele ano, e dois botões: **JOGAR FIEL** / **JOGAR
    TRADICIONAL**. Se `!fielAvailable(edition)`, o botão Fiel fica desabilitado com
    "em breve". A escolha chama `newCareer(..., mode)`.
  - "?" ao lado de cada edição (ou dentro do popup) abre/mostra a `editionLore`.
- **`editionLore` (em `editions.ts`):** campo `lore?: string` por edição (pt-BR curto,
  imersivo). Exemplos:
  - 1950: *"Aqui era assim: 4 grupos e um quadrangular final, sem decisão única. Foi onde nasceu o Maracanazo."*
  - 1970: *"16 seleções, quartas direto após os grupos. A Copa do tricampeonato e do melhor time de todos os tempos."*
  - 2026: *"48 seleções pela primeira vez: 12 grupos e os 16 avos de final. A maior Copa da história."*
  - (as 21 recebem lore na implementação.)
- **`app/cup/page.tsx`:** nº de grupos via `Object.keys(cup.groups)` (não `GROUP_NAMES`);
  rounds do chaveamento via `[...new Set(fixtures.filter(f=>f.knockout||finalGroup).map(f=>f.round))]`;
  labels via `roundLabel(cup, r)`; seção "melhores 3ºs" só quando o motor a usa
  (`engine.id` em `{g24ko, g48ko}`). "?" lore exibido no topo da copa.
- **`app/match/page.tsx`:** `ROUND_LABEL[...]` → `roundLabel(cup, r)`; `createMatch(..., pre.f.round >= 4, ...)` → `createMatch(..., pre.f.knockout, ...)`.

## Persistência (`store.ts`)

- Persist `version: 4 → 5`. Migração v4→v5:
  - cup sem `mode` → `mode: "tradicional"`;
  - fixtures sem `knockout` → `knockout: f.round >= 4` (saves 48 antigos seguem ok).
- `newCareer(coachName, editionId, formation, mode, kit?)` — novo param `mode`.
  `startCup` passa `cup.mode` adiante (ou guarda `mode` no estado da carreira até o sorteio).
- O loop de `recordResult` troca `LAST_ROUND` por `lastRound(cup)`.

## Tratamento de erros / edge cases

- Tamanho de grupo variável (1950: [4,4,3,2]): `roundRobin` gera rounds corretos;
  grupo de 2 = 1 jogo, grupo de 3 = 3 jogos. `currentRound` ignora rounds sem fixtures.
- `pickTeams(n)` com n > squads disponíveis: limita ao disponível (não trava); todos os
  motores Fase 1 cabem no dataset atual (mín. 13 times, temos ~70 squads no total).
- Grupo-final 1950: `advance` cria os fixtures do grupo final a partir dos 4 1ºs de
  grupo; `champion` retorna o 1º do grupo final quando todos os jogos do grupo final
  terminam; `userAlive` = usuário está no grupo final e ainda pode terminar em 1º
  (ou já terminou em 1º).

## Testes (`lib/game/formats/__tests__/`)

Por motor (16/24/32/48/1950):
- nº de times == `teamCount`; todo time fecha um XI (via `assignLineup`).
- `build` gera fixtures de grupo coerentes; `advance` percorre todas as fases até
  `champion(cup) != null` sem loop infinito (guard).
- determinismo: mesmo seed ⇒ mesmos grupos e mesmo chaveamento (hash estável).
- `g48ko`: paridade com o comportamento atual (mesmo nº de fixtures por round que hoje).
- `finalGroup1950`: existe grupo final, **não** existe fixture round=Final clássico,
  campeão = líder do grupo final, todos os fixtures `knockout: false`.
- `npm test` inteiro segue verde (engine/calibração/dados intactos).

Manual: `npm run dev` → escolher 1950 Fiel (ver quadrangular final e Maracanazo),
escolher 2026 Tradicional (idêntico ao atual), conferir popup + retângulo + "?".

## Critérios de aceite

- [ ] Escolher edição abre popup Fiel/Tradicional; retângulo fixo explica o conceito.
- [ ] Tradicional = formato 2026 atual com tema do ano, em qualquer edição.
- [ ] Fiel usa o formato real do ano (Fase 1: 16/24/32/48 + 1950); 74/78/1982 travados com "em breve".
- [ ] 1950 Fiel termina em campeão pelo grupo final, sem final clássica.
- [ ] "?" mostra mini-história por edição.
- [ ] Saves antigos (v4) carregam como Tradicional sem quebrar.
- [ ] `npm test` verde; sem mudança no motor de partida.
