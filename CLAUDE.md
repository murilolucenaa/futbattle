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
lib/data/editions.ts    # 23 edições de Copa 1930–2026: sede, estádios reais (nome/cidade/capacidade), era visual
lib/game/formations.ts  # 13 formações com coordenadas 2D + effectiveOvr + assignLineup + formationLayout (offset por mentalidade, só visual)
lib/game/tactics.ts     # Mentalidades/estilos → multiplicadores do motor (tacticMods)
lib/game/rules.ts       # Regras do draft: orçamento de giros + sorteio ponderado por força (squadWeight)
lib/game/engine.ts      # Motor da partida: tick = 1 minuto, mutável, determinístico por seed, cooling break
lib/game/cup.ts         # Sorteio/avanço delegados ao motor de formato; helpers genéricos (currentRound, nextUserFixture, simulateRound, recordUserResult, leaders); roundLabel(cup,r)/lastRound(cup)
lib/game/standings.ts   # groupTable/thirdPlaceTable (extraído de cup.ts p/ quebrar ciclo cup→registry→motores→standings)
lib/game/formats/       # Formato por edição: registry (mode+editionId→motor), motores g16/g24/g32/g48/finalGroup1950, shared (roundRobin/pickOpponents/estádios), types (CupEngine)
lib/game/store.ts       # Zustand + persist (chave "futbattle-career", version 5) — carreira + moral + draftDraw + cupMode
src/audio/SoundManager.ts # Motor de áudio único (howler.js): canais ui/music/ambience/match,
                        #   volumes+mute persistidos, autoplay-unlock com fila, duck, silent-fail
src/audio/manifest.json # Contrato de sons (path extensionless → /public/audio/<path>.webm), canal, volume, desc
src/audio/useUISound.ts # Delegação global [data-sound] + navegação por teclado (setas/Enter/Esc) estilo PS2
src/audio/SoundProvider.tsx # Monta a delegação + unlock no 1º gesto (substitui o antigo SfxRoot)
scripts/gen-placeholder-sfx.ts # Gera placeholders WAV-em-.webm p/ cada som do manifesto (npm run gen:sfx)
scripts/gen-verify-state.ts # Sintetiza save v4 (carreira 2026 + copa sorteada) p/ testar /match sem draft
src/match/presentation/ # Camada de APRESENTAÇÃO da partida (PixiJS). director.ts é o ÚNICO que
                        #   conhece a engine: chama tick() sob demanda e coreografa cada minuto em
                        #   "beats" de bola (passes bezier, conduções, chutes, comemoração ~3s).
                        #   agents.ts (steering puro, timestep fixo 60Hz), ball.ts, crowd.ts,
                        #   gkColors.ts (cor de goleiro auto, contraste c/ 2 kits), MatchStage.tsx
                        #   (Pixi Application; DOM acima é só HUD). Testes em __tests__/ cobrem
                        #   determinismo (seed ⇒ mesma coreografia) e continuidade da bola.

app/page.tsx            # Home: logo gigante, Novo Campeonato, Online/idiomas "em manutenção", técnico + edição
app/squad/page.tsx      # DraftView (fluxo 7-0: dado → seleção inteira → carimbo) + ManageView (prancheta FIFA)
app/cup/page.tsx        # Grupos A–L, ranking dos 3ºs, líderes (gols/assist/notas), chaveamento de 2 lados
app/match/page.tsx      # Pré-jogo (face-off PES: mini-campo/uniformes/forças) + partida 2D + pós-jogo
components/Pitch.tsx    # Campo SVG reutilizável (vertical p/ escalação, horizontal p/ partida)
components/PressConference.tsx # Coletiva de TV animada antes do draft: flashes em canvas, typewriter, lower-third (pulável, introSeen)
components/game/ShareCard.tsx   # Card 1080×1920 da escalação (html-to-image) — usado pela prancheta
components/TopBar.tsx   # Nav com "Copa" travada até o sorteio ("Faça o sorteio primeiro, mister")
components/icons.tsx    # Ícones SVG inline — não usar emojis genéricos na UI
```

Fluxo: Home → nome do técnico → edição da Copa → `newCareer` → coletiva → draft em `/squad` → `completeDraft` → `startCup` → loop `/cup` → `/match` (pré-jogo → ao vivo → pós-jogo) → `recordResult` (grava o jogo, simula a rodada simultânea, atualiza moral e líderes, avança fases) → campeão ou eliminado.

## Regras do jogo (não quebrar)

### Draft (fluxo 7-0)
- 11 titulares (posições da formação base, trocável via `setDraftFormation`) + **4 reservas** (posição livre).
- "RODA O DADO" sorteia uma **seleção inteira** com **peso inverso à força** (`squadWeight`); o elenco aparece em **ordem de escalação** (GOL→CA). O jogador clica num craque e **só as vagas compatíveis acendem** (`positions`); preenchidas/incompatíveis ficam cinza — **improvisar é impossível no draft** (na prancheta continua possível, com confirmação).
- Economia de giros: rolar é grátis logo após escalar alguém (ou no 1º giro); rolar de novo sem escalar consome `REROLL_BUDGET = 4`; fechar os 11 dá `BENCH_REROLL_BONUS = +1`; seleção sem ninguém aproveitável → giro grátis.
- **Mudar geração** (−1 giro): mesma nação, **outro ano aleatório** — o usuário não escolhe qual. **Outra seleção** (−1 giro): **mesmo ano**, outra nação aleatória (fallback: ano mais próximo).
- O draw atual persiste no store (`draftDraw`) — recarregar a página **não** dá giro grátis (anti-burla).
- Mesmo **nome** não pode ser convocado duas vezes (Pelé 1958 e Pelé 1970 são o mesmo jogador).

### Ratings & dados
- Cartas **históricas** usam rating de auge da carreira (Pelé 99 em 1958 e em 1970). Cartas **2026** usam a **força atual** do jogador (Messi 87, CR7 85, Modrić 84 — nada de auge). Escala 74–99; ≥95 reservado ao tier GOAT; **99 só lendas absolutas** (Pelé, Maradona 86, Ronaldo 02, Messi 22).
- **Todo squad ancora numa Copa do Mundo real** — nunca Euro/ano sem Copa (fra-1986, ned-1990, por-2018, não 1984/1988/2016).
- **Dados são seleções reais** — jogadores, elencos e anos historicamente corretos. Nunca inventar jogador. Todo squad: ≥11 jogadores, ≥1 GK, fecha um XI (testado).
- Posições exibidas em pt-BR via `POSITION_SHORT` (GOL, LD, ZAG, LE, VOL, MC, MEI, PD, PE, CA); códigos internos seguem em inglês.
- Edições (`editions.ts`): estádios reais com cidade/capacidade; `era` ("vintage"→"ultra") controla o tema do gramado/arquibancada (`.pitch-*`/`.stands-*` em globals.css).

### Táticas
- 13 formações × 3 mentalidades × 5 estilos via `tacticMods`. Fora de posição: mesma linha −4, linha diferente −9, GK ↔ linha −20/−25.
- Na prancheta (FIFA-style: campo + banco na lateral): arrastar um jogador sobre outro troca posição (raio ~17%); o transform de centralização fica no wrapper e o framer-motion só anima o nó interno — **não juntar os dois** (transform fight = chips pulando). Troca entre setores pede confirmação engraçada. Drag-swap é framer-motion **de propósito** (não migrar pra dnd-kit). Trocar a mentalidade reposiciona os chips via `formationLayout` (transição CSS em left/bottom, com stagger) — o time "respira". Botão "Compartilhar" gera o `ShareCard` via html-to-image.
- Medidores ATA/MEI/DEF (FIFA-like) atualizam conforme o time entra em campo.

### Partida
- `tick()` = 1 minuto; estado mutável vive em `useRef` na página. O loop é do **director** (`src/match/presentation/director.ts`): ele chama `tick()`/`aiMaybeAct()` quando a fila de beats esvazia (~650ms por minuto sem evento × velocidade 1/1.5/2x) — a página NÃO roda `setInterval`. "Pular para o fim" destrói o director e roda síncrono.
- **Pré-jogo** obrigatório (face-off estilo PES): estádio do fixture, clima/público determinísticos pelo seed, dois times espelhados com mini-campo (setas ‹ › trocam a formação ao vivo só no seu lado), faixa central com VS + forças + uniforme (kit 1/2). Hino (`anthem`) toca e corta no apito. Adversário troca pro `kit2` se as cores baterem (`colorDist < 160`). **Sem odds/apostas** — removido.
- Máx. **3 substituições**; sugestão automática (GK → GK). A tática ao vivo abre em **overlay full-screen "VESTIÁRIO"** (botão TÁTICA pausa o director; fechar dá apito + `syncLineups()`); o rodapé tem só Narração | Estatísticas. Adversário **somente leitura**, com cansaço e moral.
- **Cooling break** aos 25'/70' quando a edição é ≥2022 ou clima "heat" (`createMatch(..., coolingBreaks)`).
- Campo renderizado em **PixiJS** (`MatchStage.tsx`): 22 agentes com steering (âncora tática + perseguição da bola pelos 2 mais próximos + separação), ~600 pontos de torcida nas cores dos kits (atrás de cada gol só a torcida do dono; mudam de lado no espelhamento do 2º tempo), goleiros com cor automática de alto contraste (`pickGkColors`). Nome só no jogador com bola + hover. No 2º tempo o render é **espelhado** (`snapshot().mirrored`). Coordenadas internas seguem a engine (x 0→100 = ataque do mandante); espelhar só no draw.
- A bola **nunca teleporta**: todo evento de chute tem build-up (passe → condução → finalização); o feed de narração só "libera" o evento quando a bola chega (sem spoiler). Stoppage/reset re-ancoram `from` na posição atual da bola ao iniciar (senão teleporta — testado).
- Mata-mata empatado → pênaltis, nunca termina empatado. Gol = banner não-bloqueante + comemoração ~3s no canvas (convergência no autor + explosão da torcida) + `goal.horn`.
- Calibração: ~2,7 gols/jogo (teste trava 1,2–5,5 em 200 sims). Mexeu em `SHOT_BASE`/`goalP` → `npm test`.
- Determinismo: mesmo seed ⇒ mesmo jogo (`fixtureSeed`). Ações ao vivo alteram o fluxo do RNG — esperado.
- Narração do engine **sem emojis** — a UI põe ícones SVG por tipo de evento.

### Copa (formato por edição: Fiel vs Tradicional)
- **Modo** (`cup.mode`, escolhido no popup da home): **Tradicional** = motor g48 (formato 2026) em qualquer edição; **Fiel** = formato real do ano. `engineFor(mode, editionId)` resolve o motor (`formats/registry.ts`). 1974/78/1982 no Fiel ficam **travados** (`fielAvailable=false`, "em breve" — Fase 2).
- Motores: `groupsSemi1930` (13 times, 4 grupos [4,3,3,3] → vencedor de cada → 2 semis → final, **sem disputa de 3º** — pódio deriva o 3º do melhor perdedor de semi), `knockout1934`/`knockout1938` (mata-mata puro 16, oitavas→quartas→semi→3º→final, **sem grupos**: `cup.groups={}`, `userGroup=""` — fábrica `knockoutEngine` em `knockout.ts`), `finalGroup1950` (13 times, 4 grupos [4,4,3,2] → quadrangular final, campeão = 1º do grupo "FINAL", **sem final clássica**), `g16` (1954–70, 4 grupos→quartas), `g24` (1986–94, 6 grupos + 4 melhores 3ºs), `g32` (1998–2022, 8 grupos), `g48` (2026 + Tradicional). Edição sem grupos → `cup/page.tsx` esconde a aba "Fase de grupos" e abre direto no chaveamento (`GenericBracket`).
- **`Fixture.knockout`** define mata-mata (pênaltis no empate) — substitui o antigo `round >= 4`. Grupo-final de 1950 é `knockout:false`. `roundLabel(cup,r)`/`lastRound(cup)` delegam ao motor (não há mais `ROUND_LABEL`/`LAST_ROUND` estáticos). `cup/page.tsx` deriva nº de grupos de `cup.groups` e rounds de mata-mata dos fixtures `knockout`.
- 2026: 48 times, **12 grupos A–L**; classificação pontos → saldo → gols pró (→ hash). **Top 2 + 8 melhores 3ºs** avançam. Rounds: 1–3 grupos · 4 = 16 avos · 5 = oitavas · 6 = quartas · 7 = semi · **8 = 3º lugar** · 9 = FINAL.
- R32: vencedores × terceiros/vices de grupos diferentes (fix-up evita confronto do mesmo grupo); chaveamento em 2 lados de 8.
- Semis completas criam **3º lugar e final juntos**; se o usuário está na final, a disputa de 3º é simulada antes (loop em `recordResult` usa `nextUserFixture`, não assuma round único).
- `leaders(cup, "goals"|"assists"|"rating")` lê `cup.playerTotals`, alimentado por `recordUserResult`/`simulateRound`. Notas exigem ≥2 jogos.
- Moral do elenco (`store.morale`, 20–99): resultado ±6, gol +4, assistência +3, cartão −2, nota ≥8/<6 ±3.
- Quando o usuário joga, `recordResult` simula o resto da rodada "ao mesmo tempo"; eliminado → simula até o campeão e mostra pódio (`podium`).

## Convenções

- UI em **pt-BR** (narração, labels, mensagens). Código/comentários em inglês.
- **Sem emojis genéricos de iPhone na UI** — usar `components/icons.tsx` (SVG). Exceções: bandeiras de seleções e ⭐ do time do usuário.
- Linguagem visual: **"Fliperama da Copa"** — tokens/classes `arc-*` em globals.css (`--ink/--paper/--amarelo/--lima/--laranja/--ciano/--rosa`, `.arc-btn/.arc-panel/.arc-mini/.arc-strip/.arc-tag/.arc-bg/.arc-logo/.pitch-arc`): bordas de tinta 3px, sombras duras deslocadas, cores chapadas, papel sobre gramado, display Anton + Archivo 600–900. Dentro de `.arc-panel/.arc-mini` as vars do tema escuro (`--muted/--accent/--gold`…) são re-mapeadas pra tinta legível. **Proibido**: gradiente roxo/glow neon/glassmorphism em telas novas. Som/haptics: `data-sound` em qualquer elemento clicável (valor opcional: `confirm|cancel|back|tab|error|dice|stamp|reveal`; hover/foco → `ui.move`, press → o evento). Delegação global via `SoundProvider`.
- Áudio: tudo pelo `src/audio/SoundManager` (`sound.play/music/ambience/duck/stopAll`). Sons declarados no `manifest.json` e servidos de `/public/audio/<path>.webm` — trocar o arquivo troca o som sem mexer no código. Sons reais devem ser **CC0** (Kenney/freesound CC0) ou sintetizados — nunca rips de PES/Konami. `npm run gen:sfx` gera placeholders.
- Coordenadas de formação: `x` 0→100 = gol próprio→adversário; `y` 0→100 = lateral esquerda→direita. Campo vertical: `left = y%`, `bottom = x%`; horizontal espelha o visitante (e os dois lados após o intervalo).
- Páginas client-side com zustand persist precisam do guard `mounted` antes de ler o store (hidratação).
- Sem Supabase/serviços externos — tudo offline. "Online" e idiomas ES/EN existem na home como **placeholders "em manutenção"**; implementar é feature nova.
- Estado persistido: `version: 3` + `migrate` no persist. Saves <v3 (ids de squads antigos, sem draftDraw) são descartados de propósito; mudanças de shape futuras devem subir a versão ou tolerar merge raso.

## Armadilhas conhecidas

- `currentRound()` retorna o primeiro round com fixture existente não jogada; rounds de mata-mata só existem após `advanceCup`. Com a disputa de 3º lugar, o usuário pode ter fixture num round **maior** que `currentRound()` — use `nextUserFixture(cup)` para achar o jogo do usuário, nunca `userFixture(currentRound())`.
- `engine.ts` muta o estado; nunca guardar `LiveMatchState` no zustand. Ele vive em `useRef` na página de partida; o pré-jogo (`PreMatch`) só monta o engine no "Apito inicial".
- Nome de exibição nos chips usa `shortName()` (último nome, exceto sufixos) — duplicado em `app/squad/page.tsx` e `app/match/page.tsx`.
- Se usuário e adversário escalarem a **mesma carta** (mesmo player id de squads iguais), `playerStats` colide no engine — caso raro conhecido, não tratado.
- `KIT2_BY_NATION` em squads.ts é chaveado pelo nome da nação em pt-BR; nova seleção com nação nova precisa de entrada lá (ou herda cores invertidas).

# MISSÃO: FUTBATTLE 2.0 — DE SITE PARA JOGO

O FutBattle hoje funciona bem (simulação, copa de 48 seleções, sorteio, mata-mata),
mas a apresentação parece um dashboard SaaS dark genérico: cards, botões pílula,
tipografia neutra, página que rola. A missão é fazer ele PARECER e SOAR um jogo
desde o primeiro pixel, sem quebrar a lógica existente.

## NORTE ESTÉTICO (3 referências, 1 identidade)
1. PES 6 / PES 2012 (telas de menu e Edit Position): densidade de informação,
   chips de posição coloridos (GK dourado, DEF azul, MEI verde, ATA vermelho),
   radar hexagonal de atributos, mini-campo tático, navegação que parece console.
2. Jogo "7-0 / Dream World Cup": tipografia display gigante e condensada,
   estética de pôster impresso, números enormes como herói da tela.
3. Jogos de pênalti em Flash dos anos 2000: charme 2D direto, arquibancada viva,
   feedback imediato — mas executado com tecnologia moderna e fluida.

Identidade resultante: "transmissão de TV de futebol dos anos 2000 encontra
menu de console". Noite de estádio, verde gramado saturado, grafismos diagonais,
tipografia condensada pesada, textura sutil de ruído/halftone, e SOM em tudo.

## REGRAS INEGOCIÁVEIS
- TELAS, não páginas. Nada de landing page que rola. Cada estado do jogo é uma
  tela cheia com transição animada (slide/wipe estilo console + whoosh sonoro).
- Toda interação tem feedback duplo: motion + áudio. Hover = blip. Confirmar =
  thunk. Voltar = swipe reverso. Sortear = rufar. Gol = explosão.
- Densidade tipo PES: tabelas, escalações e stats compactos e legíveis,
  não cards espaçados de SaaS.
- Copy da interface continua em PT-BR, tom de narração esportiva
  ("CONVOCAÇÃO", "PRANCHETA", "MATA-MATA", "VESTIÁRIO").
- ARQUITETURA: separar rigorosamente lógica de simulação (mantém intocada) da
  camada de apresentação (refeita). Antes de qualquer mudança, mapear o código
  atual e listar onde lógica e UI estão acopladas.
- ÁUDIO LEGAL: proibido usar assets ripados de PES/Konami ou de qualquer jogo.
  Criar SFX "estilo PES" via síntese (jsfxr/Tone.js/Web Audio) ou packs CC0
  (ex.: Kenney.nl, freesound CC0). Mesma vibe, zero risco.

## STACK PERMITIDA (instalar conforme necessário)
- Phaser 3 → cenas de partida 2D e mini-game de pênalti
- Howler.js → gerenciador central de áudio (sprites de som, loops de torcida)
- GSAP (ou Framer Motion se o app for React) → transições de tela e micro-interações
- jsfxr / Tone.js → síntese de SFX retrô estilo PES
- Sprite sheets + TexturePacker-style atlas para animação de jogadores
- canvas-confetti ou partículas próprias no Phaser para celebrações
- html-to-image (JÁ EM USO) → rasteriza o `ShareCard` 1080×1920 pro compartilhamento

## PROCESSO
- Trabalhar em fases com checkpoint. Ao fim de cada fase: rodar o jogo,
  tirar screenshots, comparar com as referências e listar o que ainda
  "parece site". Só avançar quando a fase estiver aprovada.

## STATUS DAS FASES
- Fase 1 (design system + /styleguide): ENTREGUE — tokens de jogo em globals.css,
  componentes em components/game/, áudio migrado p/ src/audio/SoundManager (howler), demo em /styleguide.
- Fase 4 (coletiva animada): ENTREGUE — `PressConference` virou cena de transmissão
  (flashes em `<canvas>` 60fps, typewriter, lower-third, fade-to-black, reduced-motion).
  Sons `camera.flash`/`crowd.murmur` no manifesto; `sound.play(..., { rate })` p/ pitch.
- Fase 5 (prancheta): ENTREGUE — `formationLayout(formation, mentality)` move o bloco
  (presentation-only) e os chips animam ao trocar a mentalidade; card de compartilhar
  1080×1920 (`components/game/ShareCard.tsx` + `html-to-image`, Web Share API/download).
  Drag-swap segue em framer-motion (NÃO migrado p/ dnd-kit, de propósito).
- Fase 6 (copa): ENTREGUE — card do próximo jogo como herói (bandeiras grandes, Anton,
  "VS" pequeno, à prova de overflow); tabela com `tabular-nums` + barra de classificação.
- Fase 7 (pré-jogo): ENTREGUE — face-off PES espelhado, mini-campo com setas ‹ › que
  trocam a formação ao vivo, faixa central (VS + forças + uniforme), hino até o apito.
  Painel de odds/zebra + apostas REMOVIDO. "Editar escalação" leva à prancheta (/squad);
  overlay modal embutido ainda pendente.
- Fases 2–3 (telas base) absorvidas no redesign "fliperama"; Fase 8 (partida em Pixi/Phaser,
  steering, torcida, pênaltis): PENDENTE.
