"use client";

// ============================================================
// FUTBATTLE 2.0 — Fase 1 styleguide. Living demo of the game
// design system: tokens, components, transitions and sound map.
// Dev/approval screen — not linked from the game flow.
// ============================================================

import { useEffect, useState } from "react";
import type { Position } from "@/lib/game/types";
import PosChip from "@/components/game/PosChip";
import PlayerCard from "@/components/game/PlayerCard";
import HexRadar from "@/components/game/HexRadar";
import Scoreboard from "@/components/game/Scoreboard";
import GroupTable, { type GroupRow } from "@/components/game/GroupTable";
import GameButton from "@/components/game/GameButton";
import PlayerChip from "@/components/game/PlayerChip";
import GameShell from "@/components/game/GameShell";
import { useScreenWipe } from "@/components/game/ScreenWipe";
import { sound, isMuted, setMuted, getVolume, setVolume, type Channel } from "@/src/audio/SoundManager";

// Demo rows straight from the manifest contract — every declared sound.
const SFX_DEMO: { event: string; channel: string; desc: string }[] =
  Object.entries(sound.events()).map(([event, e]) => ({ event, channel: e.channel, desc: e.desc ?? "" }));

const PALETTE = [
  { name: "Noite de estádio", varName: "--night", hex: "#050B14" },
  { name: "Arquibancada", varName: "--night-2", hex: "#0A1322" },
  { name: "Verde gramado", varName: "--grass", hex: "#18A857" },
  { name: "Gramado sombra", varName: "--grass-deep", hex: "#0B6231" },
  { name: "Branco giz", varName: "--chalk", hex: "#F4FFF8" },
  { name: "Dourado troféu", varName: "--trophy", hex: "#FFC53D" },
  { name: "Vermelho cartão", varName: "--card-red", hex: "#E5293E" },
  { name: "Neon de menu", varName: "--accent", hex: "#00FF87" },
];

const ALL_POSITIONS: Position[] = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

const SAMPLE_PLAYERS = [
  { name: "Pelé", pos: "ST" as Position, ovr: 99, flag: "🇧🇷", code: "BRA 70", radar: [99, 96, 92, 60, 88, 98] },
  { name: "Maradona", pos: "AM" as Position, ovr: 98, flag: "🇦🇷", code: "ARG 86", radar: [95, 90, 96, 52, 80, 99] },
  { name: "Beckenbauer", pos: "CB" as Position, ovr: 96, flag: "🇩🇪", code: "ALE 74", radar: [70, 78, 92, 97, 90, 91] },
  { name: "Yashin", pos: "GK" as Position, ovr: 95, flag: "🇷🇺", code: "URS 66", radar: [40, 70, 75, 98, 92, 85] },
  { name: "Garrincha", pos: "RW" as Position, ovr: 95, flag: "🇧🇷", code: "BRA 62", radar: [90, 97, 88, 45, 72, 99] },
];

const SAMPLE_GROUP: GroupRow[] = [
  { flag: "⭐", name: "Seleção Murilo", pts: 7, j: 3, v: 2, e: 1, d: 0, gp: 6, gc: 2, user: true },
  { flag: "🇧🇷", name: "Brasil 1970", pts: 6, j: 3, v: 2, e: 0, d: 1, gp: 8, gc: 4 },
  { flag: "🇮🇹", name: "Itália 1982", pts: 4, j: 3, v: 1, e: 1, d: 1, gp: 3, gc: 3 },
  { flag: "🇲🇽", name: "México 1970", pts: 0, j: 3, v: 0, e: 0, d: 3, gp: 1, gc: 9 },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="tv-slab mb-3 inline-block bg-[var(--accent)] px-4 py-1 font-display text-lg uppercase tracking-wider text-[#04130B]">
      {children}
    </h2>
  );
}

function VolumeSlider({ label, ch }: { label: string; ch: Channel | "master" }) {
  const [v, setV] = useState(() => getVolume(ch));
  return (
    <label className="flex items-center gap-3">
      <span className="type-label w-20">{label}</span>
      <input
        type="range" min={0} max={100} value={Math.round(v * 100)}
        onChange={(e) => { const nv = Number(e.target.value) / 100; setV(nv); setVolume(ch, nv); }}
        onMouseUp={() => sound.play("ui.move")}
        className="w-40 accent-[var(--accent)]"
      />
      <span className="type-stat w-8 text-right text-xs text-white/60">{Math.round(v * 100)}</span>
    </label>
  );
}

export default function StyleguidePage() {
  const { wipe, overlay } = useScreenWipe();
  const [radarIdx, setRadarIdx] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [muted, setMutedState] = useState(false);
  const [stamped, setStamped] = useState(false);
  const player = SAMPLE_PLAYERS[radarIdx];

  // read persisted audio settings only after hydration (localStorage is
  // client-only — reading during render mismatches the SSR HTML)
  useEffect(() => { setMounted(true); setMutedState(isMuted()); }, []);

  return (
    <main className="texture-noise min-h-dvh pb-20">
      {overlay}

      {/* header: broadcast chrome, not a navbar */}
      <header className="tv-strip texture-halftone px-6 py-4">
        <p className="type-label">Missão FutBattle 2.0 · Fase 1</p>
        <h1 className="type-hero text-glow" style={{ fontSize: "clamp(2.5rem, 7vw, 5rem)" }}>
          Design System
        </h1>
      </header>

      <div className="mx-auto flex max-w-5xl flex-col gap-12 px-6 pt-10">

        {/* 1 · Paleta */}
        <section>
          <SectionTitle>1 · Paleta</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PALETTE.map((c) => (
              <div key={c.varName} className="overflow-hidden rounded-md border border-white/10">
                <div className="h-14" style={{ background: c.hex }} />
                <div className="bg-black/40 px-2 py-1.5">
                  <p className="text-xs font-semibold">{c.name}</p>
                  <p className="type-stat text-[10px] text-white/50">{c.varName} · {c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2 · Tipografia */}
        <section>
          <SectionTitle>2 · Tipografia</SectionTitle>
          <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-black/30 p-5">
            <p className="type-hero" style={{ fontSize: "clamp(2.5rem, 8vw, 5.5rem)" }}>Mata-mata</p>
            <p className="type-score text-[var(--accent)]">3 – 1</p>
            <p className="type-title">Convocação</p>
            <p className="type-label">Rodada 2 · Estádio Azteca · 87.000 torcedores</p>
            <p className="text-sm text-white/80">Utilitária (Inter): tabelas, stats e textos longos continuam legíveis em corpo pequeno.</p>
          </div>
        </section>

        {/* 3 · Chips de posição */}
        <section>
          <SectionTitle>3 · Chips de posição</SectionTitle>
          <div className="flex flex-wrap items-center gap-2">
            {ALL_POSITIONS.map((p) => <PosChip key={p} pos={p} />)}
          </div>
          <p className="type-label mt-2 !text-[10px]">GK dourado · DEF azul · MEI verde · ATA vermelho — padrão PES</p>
        </section>

        {/* 4 · Card de jogador + radar */}
        <section>
          <SectionTitle>4 · Elenco + radar hexagonal</SectionTitle>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="overflow-hidden rounded-md border border-white/10 bg-[var(--night-2)]">
              <div className="tv-strip px-3 py-1.5">
                <span className="font-display uppercase tracking-wider">Convocados</span>
              </div>
              {SAMPLE_PLAYERS.map((p, i) => (
                <PlayerCard
                  key={p.name}
                  {...p}
                  selected={i === radarIdx}
                  onClick={() => { setRadarIdx(i); sound.play("ui.move"); }}
                />
              ))}
            </div>
            <div className="flex flex-col items-center justify-center rounded-md border border-white/10 bg-black/30 py-4">
              <p className="font-display text-xl uppercase">{player.name}</p>
              <HexRadar values={player.radar as [number, number, number, number, number, number]} />
            </div>
          </div>
        </section>

        {/* 5 · Placar de transmissão */}
        <section>
          <SectionTitle>5 · Placar “chrome de TV”</SectionTitle>
          <Scoreboard
            home={{ code: "MUR", flag: "⭐", color: "#00FF87" }}
            away={{ code: "BRA", flag: "🇧🇷", color: "#FFD93D" }}
            score={[3, 1]}
            minute={73}
            competition="COPA 2026 · QUARTAS"
          />
        </section>

        {/* 6 · Tabela de grupo */}
        <section>
          <SectionTitle>6 · Tabela de grupo</SectionTitle>
          <div className="max-w-xl">
            <GroupTable title="Grupo A" rows={SAMPLE_GROUP} />
            <p className="type-label mt-2 !text-[10px]">Barra verde = classificado direto · dourada = melhor 3º na briga</p>
          </div>
        </section>

        {/* 7 · Botões físicos */}
        <section>
          <SectionTitle>7 · Botões com peso</SectionTitle>
          <div className="flex flex-wrap items-center gap-4">
            <GameButton onClick={() => { setStamped(true); sound.play("ui.stamp"); setTimeout(() => setStamped(false), 900); }} silent>
              Convocar
            </GameButton>
            <GameButton variant="gold" onClick={() => sound.play("match.trophy")} silent>Erguer a taça</GameButton>
            <GameButton variant="steel" onClick={() => sound.play("ui.cancel")} silent>Vestiário</GameButton>
            <GameButton disabled>Travado</GameButton>
            {stamped && (
              <span className="reveal-pop tv-slab bg-[var(--card-red)] px-3 py-1 font-display uppercase tracking-wider">
                Convocado!
              </span>
            )}
          </div>
        </section>

        {/* 8 · Transição de tela */}
        <section>
          <SectionTitle>8 · Transição de console</SectionTitle>
          <div className="flex flex-wrap gap-4">
            <GameButton silent onClick={() => wipe()}>Wipe — avançar</GameButton>
            <GameButton variant="steel" silent onClick={() => wipe(undefined, true)}>Wipe — voltar</GameButton>
          </div>
          <p className="type-label mt-2 !text-[10px]">Painel diagonal cobre a tela; a troca de rota acontece atrás dele (onCovered)</p>
        </section>

        {/* 9 · Mapa de som */}
        <section>
          <SectionTitle>9 · Mapa de som</SectionTitle>
          {mounted && (
            <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-md border border-white/10 bg-black/30 p-4">
              <GameButton
                variant={muted ? "steel" : "grass"}
                silent
                onClick={() => { const m = !muted; setMuted(m); setMutedState(m); if (!m) sound.play("ui.confirm"); }}
                className="!text-sm !px-4 !py-1.5"
              >
                {muted ? "Som: OFF" : "Som: ON"}
              </GameButton>
              <VolumeSlider label="Master" ch="master" />
              <VolumeSlider label="Interface" ch="ui" />
              <VolumeSlider label="Torcida" ch="ambience" />
              <VolumeSlider label="Música" ch="music" />
              <VolumeSlider label="Partida" ch="match" />
            </div>
          )}
          <div className="overflow-hidden rounded-md border border-white/10 bg-[var(--night-2)]">
            <table className="tv-table">
              <thead>
                <tr>
                  <th className="text-left">Evento</th>
                  <th className="text-left">Canal</th>
                  <th className="text-left">Descrição</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {SFX_DEMO.map((row) => (
                  <tr key={row.event}>
                    <td className="type-stat font-semibold text-xs">{row.event}</td>
                    <td className="text-xs text-white/60">{row.channel}</td>
                    <td className="text-[11px] text-white/50">{row.desc}</td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="tv-slab bg-white/10 px-3 py-0.5 font-display text-xs uppercase tracking-wider hover:bg-[var(--accent)] hover:text-[#04130B]"
                        onMouseEnter={() => sound.play("ui.move")}
                        onClick={() => sound.play(row.event)}
                      >
                        Ouvir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* 10 · Slots de campo + shell de 3 colunas */}
        <section>
          <SectionTitle>10 · Slots de campo (PlayerChip) & GameShell</SectionTitle>
          <div className="mb-4 flex flex-wrap items-end gap-6 rounded-md border border-white/10 bg-[var(--grass-deep)] p-6">
            <div className="text-center">
              <PlayerChip variant="filled" name="Pelé" ovr={99} flag="🇧🇷" pos="ST" />
              <p className="type-label mt-2 !text-[9px]">filled · carimbo</p>
            </div>
            <div className="text-center">
              <PlayerChip variant="empty" pos="AM" state="open" onClick={() => sound.play("ui.stamp")} />
              <p className="type-label mt-2 !text-[9px]">empty · open</p>
            </div>
            <div className="text-center">
              <PlayerChip variant="empty" pos="CB" state="dim" />
              <p className="type-label mt-2 !text-[9px]">empty · dim</p>
            </div>
            <div className="text-center">
              <PlayerChip variant="empty" pos="GK" state="idle" />
              <p className="type-label mt-2 !text-[9px]">empty · idle</p>
            </div>
          </div>
          <div className="h-[260px] overflow-hidden rounded-md border border-white/10">
            <GameShell
              leftWidth={180}
              rightWidth={160}
              left={<div className="arc-panel flex h-full items-center justify-center p-3 font-display text-lg">ESQUERDA</div>}
              center={<div className="flex h-full items-center justify-center rounded-md border-2 border-dashed border-white/20 font-display text-lg text-white/60">CENTRO (flex)</div>}
              right={<div className="arc-panel flex h-full items-center justify-center p-3 font-display text-lg">DIREITA</div>}
            />
          </div>
          <p className="type-label mt-2 !text-[10px]">3 colunas, 100dvh, scroll só interno por coluna — base da tela de convocação</p>
        </section>

        {/* 11 · Demo composta: o "veredito" */}
        <section>
          <SectionTitle>11 · Critério de pronto</SectionTitle>
          <div className="texture-halftone rounded-md border border-white/10 bg-black/40 p-6">
            <p className="type-title mb-2">Isso parece site ou menu de jogo?</p>
            <p className="text-sm text-white/70">
              Checklist Fase 1: paleta de noite de estádio ✓ · tipografia condensada pesada ✓ · chips PES ✓ ·
              radar hexagonal ✓ · placar de transmissão ✓ · tabela de grafismo de TV ✓ · botões físicos ✓ ·
              wipe de console ✓ · som em tudo ✓. Aprovado aqui → Fase 2 reconstrói as telas reais.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
