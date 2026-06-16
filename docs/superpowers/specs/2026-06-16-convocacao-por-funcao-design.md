# Convocação por função — redesign do draft

**Data:** 2026-06-16 · **Status:** aprovado no brainstorm, aguardando revisão da spec

## Contexto / problema

Hoje o draft (`/squad` DraftView) monta o time **preso a uma formação**: 11 slots vêm de
`FORMATIONS[draftFormation]`. Trocar a formação no meio do draft chama
`setDraftFormation` (`store.ts:217`), que faz `assignLineup(cards, f)` e **re-encaixa os
já escalados** nos slots da nova formação. Resultado: bug de reshuffle — o usuário pôs
James Rodríguez como MEI, sorteou Zidane, trocou pra 4-3-3 e o James foi jogado pra VOL
e o slot MEI sumiu. Além de bugado, abre brecha de manipulação (ganhar um meia extra).

A intenção do jogo é: **você é o técnico, monta o elenco e DEPOIS define suas táticas.**
O acoplamento draft↔formação atrapalha isso.

## Objetivo

Desacoplar **convocação** de **formação**:

1. **Draft** = preencher um **elenco por cota de função** (sem formação nenhuma).
2. **Prancheta** (já existe) = escolher formação + quais 11 entram, a partir do elenco.

Isso mata o reshuffle na raiz (formação não toca mais no draft) e entrega uma tela de
convocação cinematográfica (mockup aprovado em `.superpowers/brainstorm/.../convocacao-wow.html`).

### Não-objetivos
- Não mexer no motor de partida, copa, nem na lógica da prancheta de troca/improviso.
- Não trocar framer-motion por dnd-kit.

## Modelo do elenco

Elenco de **19 convocados**, por função, em formato de **depth chart** (titular + reserva):

| Função | Titulares | Reserva | Buckets de `Position` |
|---|---|---|---|
| GOL | 1 | +1 | `GK` |
| ZAG | 2 | +1 | `CB` |
| LAT | 2 | +1 | `RB`, `LB` |
| VOL | 2 | +1 | `DM` |
| MEI | 3 | +1 | `CM`, `AM` |
| ATA | 3 | +1 | `RW`, `LW`, `ST` |

Total: **13 titulares-track + 6 reservas = 19**. As cotas são generosas o suficiente pra
qualquer formação comum (4-3-3, 4-4-2, 3-5-2, 4-2-3-1) escalar 11 do pool.

**Decisão aberta p/ revisão:** 19 alonga um pouco o draft vs. os 15 de hoje. Dá pra
encolher (ex.: tirar reservas de ZAG/LAT/VOL → 16). Confirmar o tamanho na revisão.

## Mapa função (novo dado)

`POSITION_ROLE: Record<Position, Role>` em `lib/game/types.ts` (ao lado de `POSITION_SECTOR`):

```
GK→GOL · CB→ZAG · RB,LB→LAT · DM→VOL · CM,AM→MEI · RW,LW,ST→ATA
```

`Role = "GOL"|"ZAG"|"LAT"|"VOL"|"MEI"|"ATA"`. Um jogador **cabe** num bucket se ALGUMA
de suas `positions` mapeia pra ele (multi-posição acende mais de uma função).

### Exibir a posição REAL, não o bucket
O bucket (ATA/MEI/LAT…) serve só pra **cota** e pra saber quais vagas acendem. Quando
o slot é preenchido, o chip mostra a **posição específica do jogador** via
`POSITION_SHORT` — `LD/ZAG/LE` na defesa, `VOL/MC/MEI` no meio, `PD/PE/CA` no ataque —
e a prévia posiciona o dot pela posição real. Assim a linha de ataque lê
"PD · CA · PE" (variedade, escolha do técnico) em vez de "ATA · ATA · ATA".
Vaga vazia mostra o bucket (a função que falta). O usuário escolhe livremente a
sub-posição dentro do bucket; não há cota fixa por sub-posição.

## Fluxo do draft (novo)

1. **RODA O DADO** sorteia uma seleção real inteira (igual hoje, `draftDraw` persiste — anti-burla).
2. As cartas da seleção aparecem no **reel** (rodapé). Ao clicar numa carta, **só as
   funções compatíveis acendem** no quadro (via `POSITION_ROLE` das `positions` dela).
   Vagas preenchidas/incompatíveis ficam apagadas. (Substitui o "só vagas da formação
   acendem" de hoje — mesma ideia, agora por função, não por slot de formação.)
3. Clicou na vaga → carta **voa** pro slot, carimbo **CONVOCADO**, dot **pulsa** no
   mini-campo da prévia, **Força/medidores** atualizam.
4. Economia de giros: **reusar `rules.ts`** (`REROLL_BUDGET=4`, `BENCH_REROLL_BONUS=1`)
   e a regra atual "rolar é grátis logo após convocar alguém". O gatilho passa a ser
   "convocou em qualquer vaga" em vez de "escalou no slot".
5. Mesmo nome não convocado 2x (mantém regra atual). Elenco fecha quando as 19 vagas
   enchem → `completeDraft`.

Formação **não existe no draft**. Na prancheta o usuário escolhe a formação e os 11
saem do pool (reusa `assignLineup` + improviso com confirmação, como já é).

## Mudanças de estado (`store.ts`)

- `DraftSlot[]` deixa de vir de `FORMATIONS[formation]`; passa a ser definido pela
  **cota fixa por função** (`ROLE_QUOTA`), cada slot com `{ role, isReserve, card }`.
- Remover `setDraftFormation` do fluxo de draft (formação só na prancheta/tactics).
- `completeDraft`: deriva `lineupIds`/`benchIds` do pool por função (titulares-track →
  XI inicial via `assignLineup` numa formação default; reservas → banco). A prancheta
  continua reatribuindo livremente depois.
- **Subir a versão do persist** (`store.ts` version) + descartar saves antigos no
  `migrate` (shape de slots mudou) — segue o padrão já documentado no CLAUDE.md.

## Tela & animação (`app/squad/page.tsx` DraftView)

Tela cheia, estética "Fliperama da Copa" (tokens `arc-*`, sem gradiente roxo/neon):

- **Fundo:** noite de estádio (radiais de refletor, vinheta, halftone, grafismo diagonal).
- **Topo:** logo + giros em fichas + botão DADO (bob idle, shake ao rolar).
- **Esquerda — quadro por função:** linhas GOL→ATA, chips com borda de setor
  (azul/verde/laranja/dourado), GOAT (≥95) com glow ★. Chip preenchido mostra a
  **posição real** do jogador (`POSITION_SHORT`: PD/CA/PE/VOL/MC…), não o bucket.
  Vaga vazia = tracejado com o bucket (função que falta).
- **Direita — prévia do plantel:** mini-campo iluminado com os convocados por setor
  (reusar ideia do `Pitch`/dots), **medidores ATA/MEI/DEF** + **Força** (reusar `sectorOvr`/`effectiveOvr`).
- **Rodapé — seleção sorteada:** reel horizontal das cartas da seleção rolada (reusar `KitJersey`/cores).
- **Animações (framer-motion):** carta voa do reel → slot; carimbo CONVOCADO (scale+rotate);
  dot pop no campo; Força/medidor sobem. Som: `data-sound` (`dice`/`stamp`/`reveal`) já existe.

## Reúso (não reinventar)
- `lib/game/rules.ts` — economia de giros, `drawSquad`, `squadWeight`.
- `lib/game/formations.ts` — `assignLineup`, `effectiveOvr`, `sectorOvr` (na prévia/prancheta).
- `components/Pitch.tsx`, `components/game/*` (KitJersey), tokens `arc-*` de globals.css.
- `POSITION_SECTOR` (já existe) p/ cor de setor; novo `POSITION_ROLE` p/ buckets.

## Testes
- `POSITION_ROLE`: todo `Position` mapeia p/ exatamente 1 `Role`; multi-posição acende ≥1 bucket.
- Cota: `ROLE_QUOTA` soma 19 (13 base + 6 res); todo squad real consegue preencher um XI válido a partir dela (já há teste de "fecha um XI").
- Draft: convocar carta na função compatível preenche o slot; incompatível não acende;
  mesmo nome não entra 2x; fechar 19 → `completeDraft` produz `lineupIds` válido.
- Regressão: `npm test` (engine/copa intactos) + o fuzz novo continua verde.

## Risco / escopo
Mudança de gameplay real (elenco 19, draft mais longo) + tela nova com animação. É a
maior tarefa do crunch — vale fatiar o plano: (1) dados+store (lógica), (2) tela/UX, (3) animação/polish.
