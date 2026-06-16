<div align="center">

# ⚽ CONVOCADOS

**Convoque lendas, comande sua seleção como técnico e conquiste uma Copa do Mundo inteira.**

Jogo de futebol single-player no navegador, com estética de "transmissão de TV dos anos 2000
encontra menu de console". Todo o estado vive no cliente — sem backend, sem login, sem servidor.

[Jogar](https://futbattle.vercel.app) · [Como funciona](#-como-funciona) · [Rodando localmente](#-rodando-localmente)

</div>

---

## 📖 Sobre

No Convocados você **não joga, você dirige**. Assume o papel de técnico — a seleção leva o seu
nome — convoca craques históricos de seleções reais via roleta, escolhe a edição da Copa
(país-sede, ano e estádios reais) e disputa o torneio no **formato 2026**: 48 seleções,
12 grupos, mata-mata até a final, com disputa de 3º lugar e pênaltis.

Inspirado em Head Soccer, Brasfoot e PES 2010, com referências visuais de PES 6/2012,
do "Dream World Cup" e dos clássicos jogos de pênalti em Flash.

## ✨ Destaques

- **Convocação por roleta** — ~167 elencos reais de Copa (1930–2026), sorteados com peso
  inverso à força. Quanto mais fraca a seleção, mais chance de cair pra você.
- **23 edições de Copa** — de Uruguai 1930 a 2026, com 227 estádios reais (nome, cidade,
  capacidade) e tema visual de gramado/arquibancada por era.
- **Dois formatos de torneio** — *Tradicional* (formato 2026 em qualquer edição) ou
  *Fiel* (formato histórico real do ano).
- **Prancheta tática estilo FIFA** — 13 formações × 3 mentalidades × 5 estilos de jogo,
  com drag-and-drop pra trocar posições.
- **Partida 2D ao vivo** — renderizada em PixiJS com 22 agentes em *steering*, torcida nas
  cores dos kits, arquibancada que morfa pra geometria real do estádio, narração em tempo
  real, substituições, ajuste tático ao vivo e disputa de pênaltis cinematográfica.
- **Determinística** — mesma seed gera exatamente a mesma partida.
- **Som em tudo** — SFX e ambiência via Howler.js (sons CC0 ou sintetizados, nunca rips).
- **Mobile-first** — touch, safe-areas e telas que se adaptam a qualquer celular.

## 🎮 Como funciona

1. **Convocação** — Para cada posição, a roleta sorteia uma seleção histórica inteira
   (Brasil 1970, Hungria 1954, Argentina 1986…). Escale a lenda que servir ou gire de novo.
   São **11 titulares + 4 reservas**, com orçamento de giros — gaste com sabedoria.
2. **Prancheta** — Defina formação, mentalidade e estilo de jogo. Ajuste tudo a cada
   partida — e durante ela, no vestiário.
3. **Conquista** — Dispute a Copa: fase de grupos com classificação ao vivo, mata-mata
   com pênaltis, disputa de 3º lugar e a grande final. Vença ou seja eliminado.

Os ratings de cartas históricas usam o **auge** da carreira (Pelé 99); cartas de 2026 usam
a força atual do jogador (Messi 87).

## 🛠️ Stack

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 14 (App Router) · React 18 · TypeScript |
| Estado | Zustand + persist (localStorage) |
| UI / motion | Tailwind CSS · Framer Motion |
| Partida 2D | PixiJS |
| Áudio | Howler.js |
| Compartilhamento | html-to-image (cards 1080×1920) |
| Testes | Jest |

Sem Supabase, sem API externa, sem banco — **100% offline**. O torneio continua de onde parou.

## 🚀 Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
```

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (roda type-check + lint) |
| `npm test` | Suíte Jest (motor, dados e regras) |
| `npm run lint` | ESLint |
| `npm run gen:sfx` | Gera placeholders de SFX |

## 🗂️ Estrutura

```
app/          Telas (App Router): home, convocação, copa, partida
components/   UI reutilizável (campo SVG, cards, prancheta, top bar)
lib/game/     Lógica de simulação: motor da partida, copa, táticas, formações
lib/data/     Dados reais: seleções, edições, estádios
src/audio/    SoundManager (Howler) + manifesto de sons
src/match/    Camada de apresentação da partida (PixiJS)
```

> A simulação (`lib/game`) é mantida estritamente separada da camada de apresentação.

---

<div align="center">
<sub>Feito para o navegador. Toda a Copa, no cliente.</sub>
</div>
