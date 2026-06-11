# FUTBATTLE — CLAUDE.md

Jogo single-player de futebol em Next.js: o jogador é o **técnico** (a seleção leva o nome dele), convoca lendas de seleções históricas reais via roleta, escolhe a edição da Copa (país-sede + ano, com estádios reais) e disputa o torneio no **formato 2026**: 48 seleções, 12 grupos (A–L), 16 avos → final, com disputa de 3º lugar. Inspirado em head soccer, Brasfoot e PES 2010. Todo o estado vive no cliente (localStorage) — **não há backend**.

## Comandos

```bash
npm run dev      # dev server
npm test         # Jest — testes do motor, dados e regras (lib/game/__tests__)
npm run build    # build de produção (também roda type-check/lint)
npx tsc --noEmit # type-check isolado
```

## Arquitetura

```
lib/game/types.ts       # Tipos de domínio: Position (+POSITION_SHORT pt-BR), Card, Tactics, CupState, WCEdition…
lib/data/squads.ts      # Dataset: ~53 seleções reais (1950–2022), ~560 jogadores, kit2 por seleção, squadCode "BRA 70"
lib/data/editions.ts    # 20 edições de Copa 1950–2026: sede, estádios reais (nome/cidade/capacidade), era visual
lib/game/formations.ts  # 13 formações com coordenadas 2D + effectiveOvr + assignLineup
lib/game/tactics.ts     # Mentalidades/estilos → multiplicadores do motor (tacticMods)
lib/game/rules.ts       # Regras do draft: orçamento de giros + sorteio ponderado por força (squadWeight)
lib/game/engine.ts      # Motor da partida: tick = 1 minuto, mutável, determinístico por seed, cooling break
lib/game/cup.ts         # Sorteio 48 times, grupos A–L, melhores 3ºs, R32→final+3º lugar, líderes (playerTotals)
lib/game/store.ts       # Zustand + persist (chave "futbattle-career", version 2) — carreira inteira + moral
lib/sfx.ts              # SFX sintetizados via WebAudio (estilo menu de PES) — sem assets, offline

app/page.tsx            # Home: logo gigante, Novo Campeonato, Online/idiomas "em manutenção", técnico + edição
app/squad/page.tsx      # DraftView (roleta + escolha livre + medidores ATA/MEI/DEF) + ManageView (prancheta drag)
app/cup/page.tsx        # Grupos A–L, ranking dos 3ºs, líderes (gols/assist/notas), chaveamento de 2 lados
app/match/page.tsx      # Pré-jogo (estádio/clima/público/odds/uniformes) + partida 2D + pós-jogo
components/Pitch.tsx    # Campo SVG reutilizável (vertical p/ escalação, horizontal p/ partida)
components/RouletteModal.tsx   # Roleta de seleções com suspense, elenco completo e "mudar geração"
components/PressConference.tsx # Cena animada de coletiva antes do draft (pulável, introSeen)
components/TopBar.tsx   # Nav com "Copa" travada até o sorteio ("Faça o sorteio primeiro, mister")
components/icons.tsx    # Ícones SVG inline — não usar emojis genéricos na UI
```

Fluxo: Home → nome do técnico → edição da Copa → `newCareer` → coletiva → draft em `/squad` → `completeDraft` → `startCup` → loop `/cup` → `/match` (pré-jogo → ao vivo → pós-jogo) → `recordResult` (grava o jogo, simula a rodada simultânea, atualiza moral e líderes, avança fases) → campeão ou eliminado.

## Regras do jogo (não quebrar)

### Draft
- 11 titulares (posições da formação base, trocável durante o draft via `setDraftFormation`) + **4 reservas** (posição livre — vem do jogador escolhido).
- A roleta sorteia uma **seleção** com **peso inverso à força** (`squadWeight`): elencos 90+ são raros, elencos fracos são comuns. Pegar Brasil 1970 é sorte; pegar México 1970 é azar. Sem tetos de craque — o equilíbrio É o sorteio.
- O jogador escolhe **qualquer jogador** do elenco sorteado (qualquer posição) e o posiciona no campo; posições naturais acendem, improvisar pede confirmação ("Certeza disso, mister?").
- O 1º giro de cada vaga é grátis. Giros extras consomem `REROLL_BUDGET = 4`; fechar os 11 titulares dá `BENCH_REROLL_BONUS = +1`. **Mudar a geração** da seleção sorteada (ex.: Brasil 1950 → 2002) também custa 1 giro. Giro grátis quando a seleção não tem ninguém aproveitável.
- Mesmo **nome** não pode ser convocado duas vezes (Pelé 1958 e Pelé 1970 são o mesmo jogador).

### Ratings & dados
- Cada carta usa o rating de **auge da carreira** (Pelé 99 em 1958 e em 1970). Escala 74–99; ≥95 reservado ao tier GOAT.
- **Dados são seleções reais** — jogadores, elencos e anos historicamente corretos. Nunca inventar jogador. Todo squad: ≥11 jogadores, ≥1 GK, fecha um XI (testado).
- Posições exibidas em pt-BR via `POSITION_SHORT` (GOL, LD, ZAG, LE, VOL, MC, MEI, PD, PE, CA); códigos internos seguem em inglês.
- Edições (`editions.ts`): estádios reais com cidade/capacidade; `era` ("vintage"→"ultra") controla o tema do gramado/arquibancada (`.pitch-*`/`.stands-*` em globals.css).

### Táticas
- 13 formações × 3 mentalidades × 5 estilos via `tacticMods`. Fora de posição: mesma linha −4, linha diferente −9, GK ↔ linha −20/−25.
- Na prancheta: arrastar um jogador sobre outro troca posição (drag framer-motion, raio de captura ~14%); troca entre setores pede confirmação engraçada.
- Medidores ATA/MEI/DEF (FIFA-like) atualizam conforme o time entra em campo.

### Partida
- `tick()` = 1 minuto; estado mutável vive em `useRef` na página. UI roda em `setInterval` (650ms ÷ velocidade 1/1.5/2x). "Pular para o fim" roda síncrono.
- **Pré-jogo** obrigatório: estádio do fixture, clima/público determinísticos pelo seed, odds fake, escalações, escolha de uniforme (kit 1/2). Adversário troca pro `kit2` se as cores baterem (`colorDist < 160`).
- Máx. **3 substituições**; sugestão automática (GK → GK). Painel tático mostra o adversário **somente leitura**, com cansaço e moral.
- **Cooling break** aos 25'/70' quando a edição é ≥2022 ou clima "heat" (`createMatch(..., coolingBreaks)`).
- No 2º tempo o render do campo é **espelhado** (troca de lado); a bola anda "colada" no jogador mais próximo (carrier).
- Mata-mata empatado → pênaltis, nunca termina empatado. Gol = tremor de tela + rede + sfxGoal.
- Calibração: ~2,7 gols/jogo (teste trava 1,2–5,5 em 200 sims). Mexeu em `SHOT_BASE`/`goalP` → `npm test`.
- Determinismo: mesmo seed ⇒ mesmo jogo (`fixtureSeed`). Ações ao vivo alteram o fluxo do RNG — esperado.
- Narração do engine **sem emojis** — a UI põe ícones SVG por tipo de evento.

### Copa (formato 2026)
- 48 times (usuário + 47), **12 grupos A–L** de 4, round-robin de 3 rodadas. Estádio em todo fixture.
- Classificação: pontos → saldo → gols pró (→ hash estável). **Top 2 + 8 melhores 3ºs** avançam (`thirdPlaceTable`, `r32Qualifiers`).
- Rounds: 1–3 grupos · 4 = 16 avos (R32) · 5 = oitavas · 6 = quartas · 7 = semi · **8 = 3º lugar** · 9 = FINAL (`LAST_ROUND = 9`).
- R32: vencedores × terceiros/vices de grupos diferentes (fix-up evita confronto do mesmo grupo); chaveamento em 2 lados de 8.
- Semis completas criam **3º lugar e final juntos**; se o usuário está na final, a disputa de 3º é simulada antes (loop em `recordResult` usa `nextUserFixture`, não assuma round único).
- `leaders(cup, "goals"|"assists"|"rating")` lê `cup.playerTotals`, alimentado por `recordUserResult`/`simulateRound`. Notas exigem ≥2 jogos.
- Moral do elenco (`store.morale`, 20–99): resultado ±6, gol +4, assistência +3, cartão −2, nota ≥8/<6 ±3.
- Quando o usuário joga, `recordResult` simula o resto da rodada "ao mesmo tempo"; eliminado → simula até o campeão e mostra pódio (`podium`).

## Convenções

- UI em **pt-BR** (narração, labels, mensagens). Código/comentários em inglês.
- **Sem emojis genéricos de iPhone na UI** — usar `components/icons.tsx` (SVG). Exceções: bandeiras de seleções e ⭐ do time do usuário.
- Tema dark via CSS vars em `globals.css` (`--accent` verde neon, glassmorphism, fonte display Anton). Animações com framer-motion; respeitar `prefers-reduced-motion` (tratado no CSS global).
- SFX: só via `lib/sfx.ts` (WebAudio sintetizado) — nunca adicionar arquivos de áudio.
- Coordenadas de formação: `x` 0→100 = gol próprio→adversário; `y` 0→100 = lateral esquerda→direita. Campo vertical: `left = y%`, `bottom = x%`; horizontal espelha o visitante (e os dois lados após o intervalo).
- Páginas client-side com zustand persist precisam do guard `mounted` antes de ler o store (hidratação).
- Sem Supabase/serviços externos — tudo offline. "Online" e idiomas ES/EN existem na home como **placeholders "em manutenção"**; implementar é feature nova.
- Estado persistido: `version: 2` + `migrate` no persist. Saves v1 (teamName, 8 grupos) são descartados de propósito; mudanças de shape futuras devem subir a versão ou tolerar merge raso.

## Armadilhas conhecidas

- `currentRound()` retorna o primeiro round com fixture existente não jogada; rounds de mata-mata só existem após `advanceCup`. Com a disputa de 3º lugar, o usuário pode ter fixture num round **maior** que `currentRound()` — use `nextUserFixture(cup)` para achar o jogo do usuário, nunca `userFixture(currentRound())`.
- `engine.ts` muta o estado; nunca guardar `LiveMatchState` no zustand. Ele vive em `useRef` na página de partida; o pré-jogo (`PreMatch`) só monta o engine no "Apito inicial".
- Nome de exibição nos chips usa `shortName()` (último nome, exceto sufixos) — duplicado em `app/squad/page.tsx` e `app/match/page.tsx`.
- Se usuário e adversário escalarem a **mesma carta** (mesmo player id de squads iguais), `playerStats` colide no engine — caso raro conhecido, não tratado.
- `KIT2_BY_NATION` em squads.ts é chaveado pelo nome da nação em pt-BR; nova seleção com nação nova precisa de entrada lá (ou herda cores invertidas).
