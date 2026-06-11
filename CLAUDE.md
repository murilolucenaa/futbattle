# FUTBATTLE — CLAUDE.md

Jogo single-player de futebol em Next.js: o jogador convoca lendas de seleções históricas reais via roleta, comanda o time como técnico e disputa uma Copa do Mundo completa (grupos + mata-mata). Inspirado em head soccer e Brasfoot. Todo o estado vive no cliente (localStorage) — **não há backend**.

## Comandos

```bash
npm run dev      # dev server
npm test         # Jest — testes do motor, dados e regras (lib/game/__tests__)
npm run build    # build de produção (também roda type-check/lint)
npx tsc --noEmit # type-check isolado
```

## Arquitetura

```
lib/game/types.ts       # Tipos de domínio: Position, Card, Tactics, CupState, MatchResult…
lib/data/squads.ts      # Dataset: ~39 seleções reais (1950–2022), ~490 jogadores
lib/game/formations.ts  # 7 formações com coordenadas 2D + effectiveOvr + assignLineup
lib/game/tactics.ts     # Mentalidades/estilos → multiplicadores do motor (tacticMods)
lib/game/rules.ts       # Regras de balanceamento do draft (anti-apelão)
lib/game/engine.ts      # Motor da partida: tick = 1 minuto, mutável, determinístico por seed
lib/game/cup.ts         # Sorteio, tabelas de grupo, rodadas simultâneas, mata-mata
lib/game/store.ts       # Zustand + persist (chave "futbattle-career") — carreira inteira

app/page.tsx            # Home (nova jornada / continuar)
app/squad/page.tsx      # DraftView (convocação via roleta) + ManageView (escalação/tática)
app/cup/page.tsx        # Tabelas dos 8 grupos + chaveamento
app/match/page.tsx      # Partida ao vivo 2D + ResultScreen (notas, MOTM, outros jogos)
components/Pitch.tsx    # Campo SVG reutilizável (vertical p/ escalação, horizontal p/ partida)
components/RouletteModal.tsx  # Roleta de seleções com tetos e orçamento de giros
```

Fluxo: Home → `newCareer` → draft em `/squad` → `completeDraft` → `startCup` → loop `/cup` → `/match` → `recordResult` (grava o jogo do usuário, simula o resto da rodada "ao mesmo tempo" e avança fases) → campeão ou eliminado.

## Regras do jogo (não quebrar)

### Draft
- 11 titulares (posições da formação base) + **4 reservas**, máx. **1 reserva por posição**.
- A roleta sorteia uma **seleção**; o jogador escolhe um elegível daquela posição ou gira de novo.
- O 1º giro de cada vaga é grátis. Giros extras consomem o orçamento global (`REROLL_BUDGET = 10`). Sem orçamento → obrigado a escolher. Giro é **grátis** quando a seleção sorteada não tem ninguém aproveitável (sem elegíveis ou todos bloqueados por teto).
- **Tetos de estrelas** (`lib/game/rules.ts`): máx. `CAP_CRACK = 1` jogador OVR ≥ 95 e `CAP_ELITE = 3` jogadores OVR ≥ 90 no elenco de 15 (o craque conta no teto de elite). Jogadores acima do teto aparecem bloqueados (🔒) na roleta. Esses tetos existem para impedir times "apelões" só de 99 — o desafio é o sorteio real.
- Mesmo **nome** não pode ser convocado duas vezes (Pelé 1958 e Pelé 1970 são o mesmo jogador).

### Ratings
- Cada carta usa o rating de **auge da carreira** do jogador, independente do ano da seleção (Pelé 99 em 1958 e em 1970).
- Escala: 74–99. Reservados ≥ 95 para o tier GOAT (Pelé, Maradona, Messi, Ronaldo 99).
- **Dados são seleções reais** — jogadores, elencos e anos precisam ser historicamente corretos. Nunca inventar jogador. Todo squad precisa de ≥ 11 jogadores, ≥ 1 GK e cobrir o suficiente para fechar um XI (testado em `game.test.ts`).

### Táticas
- 7 formações (4-3-3, 4-4-2, 4-2-3-1, 4-3-1-2, 3-5-2, 3-4-3, 5-4-1) × 3 mentalidades × 5 estilos (posse, contra-ataque, laterais, pressão alta, falso 9). Tudo altera multiplicadores do motor via `tacticMods`.
- Fora de posição: mesma linha −4 OVR, linha diferente −9, GK ↔ linha −20/−25 (`effectiveOvr`).
- Mudar formação reatribui o elenco via `assignLineup` (greedy, posição natural primeiro).

### Partida
- `tick()` = 1 minuto. Estado mutável em ref no client; UI roda em `setInterval` (650ms ÷ velocidade). "Pular para o fim" roda os ticks restantes síncronos.
- Máx. **3 substituições**; mudanças de tática no meio do jogo valem só para aquela partida.
- Mata-mata empatado → pênaltis (`simulatePenalties`), nunca termina empatado.
- Calibração: ~2,7 gols/jogo na média (teste trava entre 1,2 e 5,5 em 200 sims). Ao mexer em `SHOT_BASE`/`goalP`, rodar `npm test`.
- Determinismo: mesmo seed ⇒ mesmo jogo (seed da fixture vem de `fixtureSeed`). Ações ao vivo do usuário alteram o fluxo do RNG — esperado.

### Copa
- 32 times (usuário + 31 squads distintos), 8 grupos de 4, round-robin de 3 rodadas.
- Classificação: pontos → saldo → gols pró (→ hash estável). Top 2 avançam.
- Oitavas: 1A×2B, 1C×2D, 1E×2F, 1G×2H, 1B×2A, 1D×2C, 1F×2E, 1H×2G.
- Quando o usuário joga, `recordResult` simula o resto da rodada como "jogos simultâneos"; se eliminado, o resto da copa é simulado até definir o campeão.

## Convenções

- UI em **pt-BR** (narração, labels, mensagens). Código/comentários em inglês.
- Tema dark via CSS vars em `globals.css` (`--accent` verde neon, glassmorphism `.glass`/`.glass-strong`, fonte display Anton via `.font-display`). Animações com framer-motion; respeitar `prefers-reduced-motion` (já tratado no CSS global).
- Coordenadas de formação: `x` 0→100 = gol próprio→gol adversário; `y` 0→100 = lateral esquerda→direita. No campo vertical render é `left = y%`, `bottom = x%`; no horizontal o time visitante é espelhado.
- Páginas client-side com zustand persist precisam do guard `mounted` antes de ler o store (hidratação).
- Sem Supabase/serviços externos — qualquer feature nova deve funcionar offline. Multiplayer não existe hoje; se voltar, é feature nova.
- Estado persistido: mudanças de shape no store devem tolerar saves antigos (merge raso do persist preenche chaves novas com o default).

## Armadilhas conhecidas

- `currentRound()` retorna o primeiro round com fixture **existente** não jogada; rounds de mata-mata só existem depois de `advanceCup` criá-los — sempre chamar `advanceCup` após completar uma rodada (já feito em `recordResult`).
- `engine.ts` muta o estado; nunca guardar `LiveMatchState` no zustand (não serializável e gigante). Ele vive em `useRef` na página de partida.
- Nome de exibição nos chips usa `shortName()` (último nome, exceto sufixos tipo "Júnior") — duplicado em `app/squad/page.tsx` e `app/match/page.tsx`.
