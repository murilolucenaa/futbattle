"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import Pitch from "@/components/Pitch";
import PressConference from "@/components/PressConference";
import GameShell from "@/components/game/GameShell";
import PlayerChip from "@/components/game/PlayerChip";
import ShareCard, { type ShareCardData } from "@/components/game/ShareCard";
import { toPng } from "html-to-image";
import SoundProvider from "@/src/audio/SoundProvider";
import { useCareer, allCards, cardById, userTeamName } from "@/lib/game/store";
import { FORMATIONS, FORMATION_IDS, effectiveOvr, formationLayout } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL, STYLE_DESC } from "@/lib/game/tactics";
import { SQUADS, SQUAD_BY_ID, squadLabel } from "@/lib/data/squads";
import { drawSquad, squadPower } from "@/lib/game/rules";
import { sound, vibrate, isMuted, setMuted } from "@/src/audio/SoundManager";
import type { Card, FormationId, GameStyle, Mentality, PlayerDef, Position, Sector, SquadDef } from "@/lib/game/types";
import { POSITION_SHORT, POSITION_SECTOR } from "@/lib/game/types";

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}

// ── Sector meters (FIFA-style ATA / MEI / DEF) ───────────────
function sectorOvr(entries: { card: Card | null; pos: Position }[], sector: Sector): number | null {
  const pool = entries.filter((e) => e.card && (sector === "DEF"
    ? POSITION_SECTOR[e.pos] === "DEF" || POSITION_SECTOR[e.pos] === "GK"
    : POSITION_SECTOR[e.pos] === sector));
  if (pool.length === 0) return null;
  return Math.round(pool.reduce((s, e) => s + effectiveOvr(e.card!, e.pos), 0) / pool.length);
}

// ── Page ─────────────────────────────────────────────────────
export default function SquadPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && c.coachName === "") router.replace("/");
  }, [mounted, c.coachName, router]);

  if (!mounted || c.coachName === "") return null;

  if (!c.draftDone && !c.introSeen) {
    return <PressConference coachName={c.coachName} editionId={c.editionId} onDone={c.markIntroSeen} />;
  }

  return (
    <>
      <SoundProvider />
      {c.draftDone ? (
        <>
          <TopBar />
          <ManageView />
        </>
      ) : (
        <div className="arc-bg flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
          <TopBar />
          <DraftView />
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   DRAFT MODE — fluxo 7-0:
   1. RODA O DADO → sai uma seleção histórica inteira.
   2. Clica num craque → só as vagas compatíveis acendem.
   3. Clica na vaga verde → carimbo. Impossível improvisar.
   ════════════════════════════════════════════════════════════ */

const POSITION_ORDER: Position[] = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

const SECTOR_ARC_BG: Record<Sector, string> = {
  GK: "var(--amarelo)", DEF: "var(--ciano)", MID: "var(--lima)", ATT: "var(--rosa)",
};

function ArcPos({ pos, dim, big }: { pos: Position; dim?: boolean; big?: boolean }) {
  return (
    <span
      className={`font-arc font-extrabold leading-none rounded-md border-2 border-[var(--ink)] uppercase ${
        big ? "text-[11px] px-2 py-[3.5px]" : "text-[9px] px-1.5 py-[2.5px]"
      }`}
      style={{ background: SECTOR_ARC_BG[POSITION_SECTOR[pos]], color: "var(--ink)", opacity: dim ? 0.35 : 1 }}
    >
      {POSITION_SHORT[pos]}
    </span>
  );
}

/** Pentagon points (svg polygon string) centred at (cx,cy), `r` circumradius, a vertex at `rot`°. */
function penta(cx: number, cy: number, r: number, rot: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const a = ((rot + i * 72) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

/** Classic stitched soccer ball — flat "fliperama" look (paper + ink patches). */
function BallIcon({ size = 64, className = "" }: { size?: number; className?: string }) {
  const verts = [-90, -18, 54, 126, 198].map((d) => {
    const a = (d * Math.PI) / 180;
    return { x: 32 + 10 * Math.cos(a), y: 32 + 10 * Math.sin(a) };
  });
  const rim = [-54, 18, 90, 162, 234].map((d) => {
    const a = (d * Math.PI) / 180;
    return { x: 32 + 21 * Math.cos(a), y: 32 + 21 * Math.sin(a), rot: d + 36 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`draw-ball ${className}`} aria-hidden>
      <defs><clipPath id="ball-clip"><circle cx="32" cy="32" r="26" /></clipPath></defs>
      <circle cx="32" cy="32" r="28" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4" />
      <g clipPath="url(#ball-clip)">
        <g stroke="var(--ink)" strokeWidth="2.6" strokeLinecap="round">
          {verts.map((v, i) => {
            const a = Math.atan2(v.y - 32, v.x - 32);
            return <line key={i} x1={v.x} y1={v.y} x2={32 + 27 * Math.cos(a)} y2={32 + 27 * Math.sin(a)} />;
          })}
        </g>
        <polygon points={penta(32, 32, 10, -90)} fill="var(--ink)" />
        {rim.map((p, i) => <polygon key={i} points={penta(p.x, p.y, 8, p.rot)} fill="var(--ink)" />)}
      </g>
    </svg>
  );
}

/** Pots tumbling inside the glass draw drum — real nations, World-Cup-draw feel. */
const DRAW_POTS = [
  { flag: "🇧🇷", bc: "var(--amarelo)", left: "30%", top: "46%", dur: 2.2, delay: 0 },
  { flag: "🇦🇷", bc: "var(--ciano)",   left: "53%", top: "54%", dur: 2.6, delay: -0.4 },
  { flag: "🇩🇪", bc: "var(--paper)",   left: "41%", top: "62%", dur: 2.0, delay: -0.9 },
  { flag: "🇫🇷", bc: "var(--rosa)",    left: "63%", top: "44%", dur: 2.8, delay: -1.3 },
  { flag: "🇮🇹", bc: "var(--lima)",    left: "21%", top: "57%", dur: 2.3, delay: -0.6 },
  { flag: "🇳🇱", bc: "var(--laranja)", left: "70%", top: "60%", dur: 2.5, delay: -1.6 },
  { flag: "🇪🇸", bc: "var(--paper)",   left: "50%", top: "37%", dur: 2.1, delay: -2.0 },
  { flag: "🇵🇹", bc: "var(--amarelo)", left: "35%", top: "35%", dur: 2.7, delay: -1.1 },
  { flag: "🇺🇾", bc: "var(--ciano)",   left: "61%", top: "67%", dur: 2.4, delay: -0.2 },
];

/** The lottery-draw scene: a glass drum of national pots on a sunburst stage. */
function DrawStage({ spinning }: { spinning: boolean }) {
  return (
    <div className={`draw-stage ${spinning ? "is-spinning" : ""}`} aria-hidden>
      <div className={`draw-rays ${spinning ? "is-spinning" : ""}`} />
      <div className="draw-stand" />
      <div className="draw-bowl">
        <span
          className="draw-ballz draw-ballz--soccer"
          style={{ left: "45%", top: "49%", ["--jd" as string]: "2.5s", ["--jdl" as string]: "-0.8s" }}
        >
          <BallIcon size={30} />
        </span>
        {DRAW_POTS.map((p, i) => (
          <span
            key={i}
            className="draw-ballz"
            style={{
              left: p.left, top: p.top,
              ["--bc" as string]: p.bc,
              ["--jd" as string]: `${p.dur}s`,
              ["--jdl" as string]: `${p.delay}s`,
            }}
          >
            {p.flag}
          </span>
        ))}
        <span className="draw-glass" />
      </div>
      <div className="draw-base" />
    </div>
  );
}

function powerTier(p: number): { label: string; color: string } {
  if (p >= 90) return { label: "ELENCO LENDÁRIO", color: "var(--rosa)" };
  if (p >= 86) return { label: "PESADÍSSIMO", color: "var(--laranja)" };
  if (p >= 82) return { label: "RESPEITÁVEL", color: "var(--amarelo)" };
  return { label: "TIME DE GUERREIROS", color: "var(--ciano)" };
}

function StatBig({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-2xl leading-none text-[var(--ink)]" style={{ color }}>
        {value && value > 0 ? value : "—"}
      </div>
      <div className="font-arc text-[8px] font-extrabold uppercase tracking-widest opacity-55">{label}</div>
    </div>
  );
}

function DraftView() {
  const c = useCareer();
  const slots = FORMATIONS[c.draftFormation];

  // draw state lives in the store (reload can't cheat a free spin)
  const storedSquad = c.draftDraw.squadId ? SQUAD_BY_ID[c.draftDraw.squadId] ?? null : null;
  const [phase, setPhase] = useState<"idle" | "rolling" | "squad">(storedSquad ? "squad" : "idle");
  const [squad, setSquad] = useState<SquadDef | null>(storedSquad);
  const [flicker, setFlicker] = useState<SquadDef | null>(null);
  const [picked, setPicked] = useState<PlayerDef | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [muted, setMutedState] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const squadUsed = c.draftDraw.used;

  useEffect(() => { setMutedState(isMuted()); }, []);
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const startersDone = c.slots.every((s) => s.card);
  const allDone = startersDone && c.benchSlots.every((b) => b.card);
  const draftedXI = c.slots.filter((s) => s.card).length;

  const usedNames = useMemo(
    () => new Set(allCards(c).map((x) => x.player.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.slots, c.benchSlots]
  );

  function showToast(msg: string) {
    setToast(msg);
    timers.current.push(setTimeout(() => setToast(null), 2400));
  }

  // bench phase grants +1 spin, once
  useEffect(() => {
    if (startersDone && !c.benchBonusGranted) {
      c.grantBenchBonus();
      showToast("FECHOU OS 11! BANCO LIBERADO · +1 GIRO");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startersDone, c.benchBonusGranted]);

  const openStarterPos = new Set(c.slots.filter((s) => !s.card).map((s) => s.pos));
  const benchOpen = startersDone && c.benchSlots.some((b) => !b.card);

  const fits = (p: PlayerDef) => benchOpen || p.positions.some((pos) => openStarterPos.has(pos));
  const eligible = (s: SquadDef) => s.players.filter((p) => !usedNames.has(p.name));
  const usable = (s: SquadDef) => eligible(s).filter(fits);

  const deadSquad = phase === "squad" && squad !== null && !squadUsed && usable(squad).length === 0;
  const rollIsFree = c.draftDraw.freeRoll || deadSquad;
  const canRoll = !allDone && phase !== "rolling" && (rollIsFree || c.rerollsLeft > 0);

  /** Dice animation flicking through `pool`, landing on `target`. */
  function runSpin(pool: SquadDef[], target: SquadDef) {
    setPicked(null);
    setSquad(null);
    setPhase("rolling");
    sound.play("dado.roll");
    let n = 0;
    const spin = () => {
      setFlicker(pool[Math.floor(Math.random() * pool.length)]);
      sound.play("ui.tick");
      n++;
      if (n < 13) {
        timers.current.push(setTimeout(spin, 55 + n * 16));
      } else {
        timers.current.push(setTimeout(() => {
          setSquad(target);
          setFlicker(null);
          setPhase("squad");
          sound.play("card.reveal");
          vibrate(24);
        }, 240));
      }
    };
    spin();
  }

  /** OUTRA SELEÇÃO — any other nation (weighted by squad power). Free after a
   *  placement / on the first spin / when the drawn squad is unusable. */
  function roll() {
    if (!canRoll) return;
    const pool = SQUADS.filter((s) => usable(s).length > 0);
    const target = drawSquad(pool, { excludeId: c.draftDraw.squadId ?? undefined });
    if (!target) return;
    if (!rollIsFree) c.spendReroll();
    c.setDraftDraw({ squadId: target.id, used: false, freeRoll: false });
    runSpin(SQUADS, target);
  }

  /** OUTRA ÉPOCA — same nation, random OTHER year (you don't pick which). */
  const genPool = squad
    ? SQUADS.filter((s) => s.nation === squad.nation && s.id !== squad.id && usable(s).length > 0)
    : [];
  function rollGeneration() {
    if (!squad || squadUsed || c.rerollsLeft <= 0 || genPool.length === 0) return;
    const target = drawSquad(genPool) ?? genPool[0];
    c.spendReroll();
    c.setDraftDraw({ squadId: target.id, used: false, freeRoll: false });
    runSpin(genPool.length > 1 ? genPool : SQUADS, target);
  }

  function makeCard(p: PlayerDef): Card {
    return { player: p, squadId: squad!.id, nation: squad!.nation, year: squad!.year, flag: squad!.flag };
  }

  function revealSound(ovr: number) {
    sound.play(ovr >= 95 ? "card.reveal.legendary" : ovr >= 88 ? "card.reveal.rare" : "card.reveal");
  }

  function afterPlace(_name: string, ovr: number) {
    setPicked(null);
    c.setDraftDraw({ used: true, freeRoll: true });
    revealSound(ovr);
    vibrate(24);
  }

  function placeStarter(i: number) {
    if (!picked || c.slots[i].card) return;
    if (!picked.positions.includes(c.slots[i].pos)) { sound.play("ui.error"); return; }
    c.fillSlot(i, makeCard(picked));
    afterPlace(picked.name, picked.ovr);
  }

  function placeBench(i: number) {
    if (!picked || !startersDone || c.benchSlots[i].card) return;
    c.fillBench(i, makeCard(picked));
    afterPlace(picked.name, picked.ovr);
  }

  /** Click a list row a second time → drop into the first compatible open slot. */
  function confirmPick(p: PlayerDef) {
    const si = c.slots.findIndex((s) => !s.card && p.positions.includes(s.pos));
    if (si >= 0) { c.fillSlot(si, makeCard(p)); afterPlace(p.name, p.ovr); return; }
    if (benchOpen) {
      const bi = c.benchSlots.findIndex((b) => !b.card);
      if (bi >= 0) { c.fillBench(bi, makeCard(p)); afterPlace(p.name, p.ovr); return; }
    }
    sound.play("ui.error");
  }

  const roster = squad
    ? [...squad.players].sort((a, b) => {
        const d = POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]);
        return d !== 0 ? d : b.ovr - a.ovr;
      })
    : [];

  // box-score numbers (current XI)
  const meterEntries = c.slots.map((s) => ({ card: s.card, pos: s.pos }));
  const filledStarters = c.slots.filter((s) => s.card);
  const teamOvr = filledStarters.length
    ? Math.round(filledStarters.reduce((sum, s) => sum + effectiveOvr(s.card!, s.pos), 0) / filledStarters.length)
    : 0;

  const tier = squad ? powerTier(squadPower(squad)) : null;
  const showSpend = !squadUsed && (c.rerollsLeft > 0 || deadSquad);

  // ── LEFT: sorteio ─────────────────────────────────────────
  const left = (
    <div className="arc-panel flex min-h-0 flex-col p-4 lg:h-full">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <span className="font-display text-xl leading-none tracking-wide">CONVOCAÇÃO</span>
        <div className="flex items-center gap-2.5">
          <span className="font-arc font-extrabold uppercase">
            <b className="font-display text-2xl align-middle" style={{ color: "var(--amarelo)" }}>{c.rerollsLeft}</b>
            <span className="ml-1 text-[10px] opacity-65">{c.rerollsLeft === 1 ? "giro" : "giros"}</span>
          </span>
          <button
            data-sound="confirm"
            onClick={() => { const m = !muted; setMuted(m); setMutedState(m); }}
            className="rounded-full border-2 border-[rgba(20,21,18,0.3)] px-2 py-0.5 font-arc text-[9px] font-extrabold tracking-widest"
            style={{ color: muted ? "var(--rosa)" : "var(--ciano)" }}
          >
            {muted ? "SOM OFF" : "SOM ON"}
          </button>
        </div>
      </div>

      {allDone ? (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
          <div className="font-display text-4xl leading-none text-[var(--ink)]">GRUPO FECHADO!</div>
          <p className="mb-5 mt-2 font-arc text-sm font-bold opacity-65">15 lendas no vestiário. Agora é contigo.</p>
          <button data-sound="confirm" onClick={() => c.completeDraft()} className="arc-btn arc-btn--rosa arc-btn--card w-full py-4">
            <span className="block text-xl leading-tight">Fechar convocação</span>
            <span className="mt-0.5 block font-arc text-[11px] font-bold opacity-80">sem choro depois, mister</span>
          </button>
        </div>
      ) : phase === "rolling" ? (
        <div className="flex flex-1 min-h-0 flex-col items-center justify-center text-center">
          <DrawStage spinning />
          <div className="h-8 w-full truncate px-2 font-display text-2xl text-[var(--ink)]">
            {flicker ? `${flicker.flag} ${squadLabel(flicker)}` : "…"}
          </div>
          <div className="mt-2 font-arc text-[11px] font-extrabold uppercase tracking-[0.3em] opacity-55">sorteando…</div>
        </div>
      ) : phase === "idle" || squadUsed ? (
        <div className="flex flex-1 min-h-0 flex-col text-center">
          <div className="flex flex-1 min-h-0 flex-col items-center justify-center">
            <DrawStage spinning={false} />
            <div className="-mt-2 font-arc text-[11px] font-extrabold uppercase tracking-[0.3em] opacity-50">
              urna do sorteio
            </div>
            <p className="mt-3 max-w-[17rem] font-arc text-[12px] font-bold leading-snug opacity-40">
              {squadUsed
                ? "Carimbado! Gira de novo pra chamar o próximo nome — essa é de graça."
                : "Aperta o botão: a urna gira e cospe uma seleção histórica inteira pra você garimpar."}
            </p>
          </div>
          <button data-sound="dice" disabled={!canRoll} onClick={roll} className="arc-btn arc-btn--lima arc-btn--card w-full shrink-0 py-4">
            <span className="block text-2xl leading-tight">GIRA A URNA</span>
            <span className="mt-0.5 block font-arc text-[11px] font-bold opacity-75">
              {squadUsed ? "tá escalado! próxima vaga — de graça" : "sai uma seleção histórica inteira"}
            </span>
          </button>
        </div>
      ) : squad ? (
        <>
          {/* header da seleção sorteada */}
          <div className="reveal-pop flex shrink-0 items-center gap-3 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--ink)] px-4 py-2.5 text-[var(--paper)]">
            <span className="text-4xl drop-shadow">{squad.flag}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-2xl leading-none">{squad.nation} {squad.year}</span>
              <span className="mt-1 block font-arc text-[10px] font-extrabold uppercase tracking-widest" style={{ color: tier!.color }}>
                {tier!.label} · média {Math.round(squadPower(squad))}
              </span>
            </span>
          </div>

          {/* dica de estado — altura reservada p/ não empurrar a lista ao escolher */}
          <div className="mt-2.5 flex min-h-[3.5rem] shrink-0 flex-col justify-center">
            {deadSquad ? (
              <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--laranja)] px-3 py-2 font-arc text-[11px] font-extrabold uppercase tracking-wide text-[#FFF9EE]">
                Ninguém aqui serve pras vagas que sobraram. Outra seleção — de graça.
              </div>
            ) : picked ? (
              <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--lima)] px-3 py-2 font-arc text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
                {startersDone
                  ? "Clica num reserva vazio aqui ao lado (★ Banco), ou de novo no nome"
                  : `Clica numa vaga verde no campo, ou de novo no nome (${picked.positions.map((p) => POSITION_SHORT[p]).join(" · ")})`}
              </div>
            ) : (
              <div className="px-1 font-arc text-[11px] font-extrabold uppercase tracking-wide opacity-55">
                Sua vez: clica num craque pra ver onde ele joga
              </div>
            )}
          </div>

          {/* elenco — lista com scroll interno */}
          <div className="mt-2 flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
            {roster.map((p) => {
              const used = usedNames.has(p.name);
              const noFit = !used && !fits(p);
              const can = !used && !noFit && !squadUsed;
              const isPicked = picked?.id === p.id;
              return (
                <button
                  key={p.id}
                  disabled={!can}
                  data-sound={can ? "confirm" : undefined}
                  onClick={() => (isPicked ? confirmPick(p) : setPicked(p))}
                  className={`flex w-full items-center gap-2 rounded-xl border-[2.5px] px-2 py-1.5 text-left transition-colors ${
                    isPicked
                      ? "border-[var(--ink)] bg-[var(--amarelo)]"
                      : can
                        ? "border-[rgba(20,21,18,0.25)] bg-transparent hover:border-[var(--ink)] hover:bg-[rgba(20,21,18,0.05)]"
                        : "cursor-not-allowed border-transparent opacity-35"
                  }`}
                >
                  <span className="flex shrink-0 gap-1">
                    {p.positions.map((x) => <ArcPos key={x} pos={x} dim={!can && !isPicked} />)}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-arc text-[13px] font-extrabold text-[var(--ink)]">{p.name}</span>
                  {used && (
                    <span className="shrink-0 rounded-full bg-[var(--ink)] px-1.5 py-0.5 font-arc text-[8px] font-extrabold uppercase tracking-wider text-[var(--paper)]">já é seu</span>
                  )}
                  {noFit && (
                    <span className="shrink-0 rounded-full border-2 border-[var(--ink)] px-1.5 py-0.5 font-arc text-[8px] font-extrabold uppercase tracking-wider text-[var(--ink)]">sem vaga</span>
                  )}
                  <span className="w-8 shrink-0 text-right font-display text-lg text-[var(--ink)]">{p.ovr}</span>
                </button>
              );
            })}
          </div>

          {/* rodapé fixo: 2 ações de re-sorteio */}
          <div className="mt-3 shrink-0">
            {showSpend ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  data-sound="dice"
                  onClick={roll}
                  className="arc-btn arc-btn--laranja arc-btn--card flex-1 py-2.5"
                >
                  <span className="block text-sm leading-tight">Outra seleção</span>
                  <span className="mt-0.5 block font-arc text-[9px] font-bold opacity-70">{deadSquad ? "de graça" : "−1 giro"}</span>
                </button>
                {c.rerollsLeft > 0 && genPool.length > 0 && (
                  <button
                    data-sound="dice"
                    onClick={rollGeneration}
                    className="arc-btn arc-btn--ciano arc-btn--card flex-1 py-2.5"
                  >
                    <span className="block text-sm leading-tight">Outra época</span>
                    <span className="mt-0.5 block font-arc text-[9px] font-bold opacity-70">{squad.nation} de outro ano · −1 giro</span>
                  </button>
                )}
              </div>
            ) : !squadUsed ? (
              <p className="rounded-xl border-[3px] border-dashed border-[rgba(20,21,18,0.3)] px-3 py-2.5 text-center font-arc text-[11px] font-extrabold uppercase tracking-wide opacity-60">
                Giros esgotados — fecha os 11, mister.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );

  // ── CENTER: campo ─────────────────────────────────────────
  const center = (
    <div className="flex min-h-0 flex-col lg:h-full">
      <div className="mb-2 flex shrink-0 items-center gap-1.5 overflow-x-auto pb-1">
        <span className="arc-tag shrink-0">★ Formação</span>
        {FORMATION_IDS.map((f) => (
          <button
            key={f}
            data-sound="confirm"
            onClick={() => c.setDraftFormation(f)}
            className={`arc-btn shrink-0 px-2.5 py-1 text-[11px] ${c.draftFormation === f ? "" : "arc-btn--paper"}`}
          >
            {f}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative mx-auto w-full max-w-[min(82vw,420px)] overflow-hidden rounded-[22px] border-[3px] border-[var(--ink)] shadow-[5px_6px_0_var(--ink)] lg:mx-0 lg:h-full lg:w-auto lg:max-w-full" style={{ aspectRatio: "3 / 4" }}>
          <Pitch className="pitch-arc h-full w-full !rounded-none">
            {slots.map((slot, i) => {
              const card = c.slots[i].card;
              const ok = picked !== null && !card && picked.positions.includes(slot.pos);
              return (
                <div key={i} className="absolute -translate-x-1/2 translate-y-1/2" style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}>
                  {card ? (
                    <PlayerChip variant="filled" name={shortName(card.player.name)} ovr={card.player.ovr} flag={card.flag} pos={slot.pos} dim={picked !== null} />
                  ) : (
                    <PlayerChip
                      variant="empty"
                      pos={slot.pos}
                      state={ok ? "open" : picked ? "dim" : "idle"}
                      onClick={() => { if (ok) placeStarter(i); else if (picked) sound.play("ui.error"); }}
                    />
                  )}
                </div>
              );
            })}
          </Pitch>
        </div>
      </div>
    </div>
  );

  // ── RIGHT: box score ──────────────────────────────────────
  const right = (
    <div className="arc-panel flex min-h-0 flex-col p-4 lg:h-full">
      <input
        value={c.squadName}
        onChange={(e) => c.setSquadName(e.target.value)}
        placeholder={`Seleção ${c.coachName}`}
        className="w-full shrink-0 truncate border-b-[3px] border-[rgba(20,21,18,0.25)] bg-transparent pb-1 font-display text-2xl leading-none text-[var(--ink)] outline-none focus:border-[var(--ink)]"
      />
      <div className="my-3 grid shrink-0 grid-cols-4 gap-1 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] py-2.5">
        <StatBig label="Força" value={teamOvr} color="var(--ink)" />
        <StatBig label="Ata" value={sectorOvr(meterEntries, "ATT")} color="var(--rosa)" />
        <StatBig label="Mei" value={sectorOvr(meterEntries, "MID")} color="var(--lima)" />
        <StatBig label="Def" value={sectorOvr(meterEntries, "DEF")} color="var(--ciano)" />
      </div>

      <div className="mb-1.5 flex shrink-0 items-center justify-between">
        <span className="arc-tag">★ Escalação</span>
        <span className="font-arc text-[11px] font-extrabold uppercase">
          <b className="font-display text-base" style={{ color: draftedXI === 11 ? "var(--lima)" : "var(--amarelo)" }}>{draftedXI}</b>
          <span className="opacity-55">/11</span>
        </span>
      </div>
      <div className="flex-1 min-h-0 space-y-1 overflow-y-auto pr-1">
        {c.slots.map((s, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" style={{ background: s.card ? "rgba(20,21,18,0.05)" : "transparent" }}>
            <ArcPos pos={s.pos} dim={!s.card} big />
            <span className={`min-w-0 flex-1 truncate font-arc text-[15px] font-extrabold uppercase ${s.card ? "text-[var(--ink)]" : "opacity-35"}`}>
              {s.card ? shortName(s.card.player.name) : "—"}
            </span>
            {s.card && <span className="shrink-0 font-display text-xl text-[var(--ink)]">{s.card.player.ovr}</span>}
          </div>
        ))}
      </div>

      <div className="mt-2 shrink-0">
        <span className="arc-tag mb-1.5">★ Banco</span>
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {c.benchSlots.map((b, i) => {
            const open = !b.card && picked !== null && benchOpen;
            return (
              <button
                key={i}
                type="button"
                disabled={!!b.card}
                data-sound={open ? "stamp" : undefined}
                onClick={() => { if (open) placeBench(i); }}
                className={`flex items-center gap-2 rounded-xl border-[2.5px] px-2.5 py-2 text-left ${
                  b.card
                    ? "border-[var(--ink)] bg-[var(--paper)]"
                    : open
                      ? "slot-call cursor-pointer border-[var(--ink)] bg-[var(--lima)]"
                      : "cursor-default border-dashed border-[rgba(20,21,18,0.3)]"
                }`}
              >
                {b.card ? (
                  <>
                    <span className="shrink-0 font-display text-xl text-[var(--ink)]">{b.card.player.ovr}</span>
                    <span className="min-w-0 truncate font-arc text-[12px] font-extrabold uppercase text-[var(--ink)]">{shortName(b.card.player.name)}</span>
                  </>
                ) : (
                  <span className={`font-arc text-[11px] font-extrabold uppercase ${open ? "text-[var(--ink)]" : "opacity-35"}`}>
                    {open ? "carimbar aqui" : `reserva ${i + 1}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!startersDone && (
          <p className="mt-1.5 font-arc text-[9px] font-extrabold uppercase tracking-wider opacity-45">fecha os 11 pra liberar o banco</p>
        )}
      </div>
    </div>
  );

  return (
    <main className="arc-bg min-h-0 flex-1">
      <GameShell left={left} center={center} right={right} className="h-full" />

      {/* toast carimbo */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, scale: 1.6, rotate: -8 }}
            animate={{ opacity: 1, scale: 1, rotate: -2 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 500, damping: 24 }}
            className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 rounded-full border-[3px] border-[var(--ink)] bg-[var(--amarelo)] px-6 py-2.5 font-display text-lg text-[var(--ink)] shadow-[5px_6px_0_var(--ink)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ── MANAGE MODE (Prancheta FIFA: campo + banco na lateral) ───
const METER_COLOR: Record<string, string> = { ATA: "var(--rosa)", MEI: "var(--lima)", DEF: "var(--ciano)" };

function ManageChip({ card, pos, selected, morale, dragging }: {
  card: Card; pos: Position; selected?: boolean; morale: number; dragging?: boolean;
}) {
  const eff = effectiveOvr(card, pos);
  const penalized = eff < card.player.ovr;
  return (
    <div className={`flex flex-col items-center select-none ${dragging ? "" : "transition-transform hover:scale-105"}`}>
      <div className={`relative w-11 h-11 rounded-full border-[3px] flex items-center justify-center font-display text-sm shadow-[2px_3px_0_var(--ink)] ${
        selected ? "border-[var(--amarelo)] bg-[var(--ink)]" : "border-[var(--ink)] bg-[var(--paper)]"
      }`}>
        <span style={{ color: selected ? "var(--amarelo)" : penalized ? "#C0182B" : "var(--ink)" }}>{eff}</span>
        <span className="absolute -top-2 -right-2 text-xs drop-shadow">{card.flag}</span>
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-[4px] w-7 rounded-full overflow-hidden bg-black/40 border border-black/50" title={`Moral ${morale}`}>
          <span className="block h-full" style={{ width: `${morale}%`, background: morale >= 70 ? "var(--lima)" : morale >= 45 ? "var(--amarelo)" : "#C0182B" }} />
        </span>
      </div>
      <span className={`mt-1.5 font-arc text-[9px] font-extrabold uppercase rounded-full px-1.5 py-px max-w-[76px] truncate ${
        selected ? "bg-[var(--amarelo)] text-[var(--ink)] border-2 border-[var(--ink)]" : "bg-[var(--ink)] text-[var(--paper)]"
      }`}>
        {shortName(card.player.name)}
      </span>
      <span className="font-arc text-[8px] font-extrabold uppercase text-white/80 mt-px">{POSITION_SHORT[pos]}</span>
    </div>
  );
}

function ManageView() {
  const router = useRouter();
  const c = useCareer();
  // mentality reshapes the block (presentation-only) — chips animate to it
  const slots = formationLayout(c.tactics.formation, c.tactics.mentality);
  const lineup = c.lineupIds.map((id) => cardById(c, id));
  const bench = c.benchIds.map((id) => cardById(c, id)).filter((x): x is Card => !!x);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [confirmSwap, setConfirmSwap] = useState<{ a: number; b: number } | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRowRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // share card capture
  const shareRef = useRef<HTMLDivElement>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const teamOvr = Math.round(
    lineup.reduce((s, card, i) => s + (card ? effectiveOvr(card, slots[i].pos) : 0), 0) / 11
  );

  function crossSector(a: number, b: number): boolean {
    const ca = lineup[a], cb = lineup[b];
    const pa = slots[a].pos, pb = slots[b].pos;
    const bad = (card: Card | null, pos: Position) =>
      !!card && !card.player.positions.some((p) => POSITION_SECTOR[p] === POSITION_SECTOR[pos]);
    return bad(ca, pb) || bad(cb, pa);
  }

  function requestSwap(a: number, b: number) {
    if (a === b) return;
    if (crossSector(a, b)) setConfirmSwap({ a, b });
    else { sound.play("ui.stamp"); vibrate(12); c.swapLineup(a, b); }
  }

  function clickLineup(i: number) {
    sound.play("ui.confirm");
    if (selIdx === null) setSelIdx(i);
    else if (selIdx === i) setSelIdx(null);
    else { requestSwap(selIdx, i); setSelIdx(null); }
  }
  function clickBench(card: Card) {
    if (selIdx === null) return;
    sound.play("ui.stamp");
    vibrate(12);
    c.swapWithBench(selIdx, card.player.id);
    setSelIdx(null);
  }

  // drag a chip near another slot to swap — centering transform lives on the
  // wrapper, framer only animates the inner node (no transform fights)
  function onDragEnd(fromIdx: number, point: { x: number; y: number }) {
    // dropped over a bench row → swap with that reserve
    for (let i = 0; i < bench.length; i++) {
      const row = benchRowRefs.current[i];
      if (!row) continue;
      const r = row.getBoundingClientRect();
      if (point.x >= r.left && point.x <= r.right && point.y >= r.top && point.y <= r.bottom) {
        sound.play("ui.stamp");
        vibrate(12);
        c.swapWithBench(fromIdx, bench[i].player.id);
        return;
      }
    }
    const el = pitchRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((point.x - r.left) / r.width) * 100;   // left %
    const py = (1 - (point.y - r.top) / r.height) * 100; // bottom %
    let best = -1, bestD = Infinity;
    slots.forEach((s, i) => {
      const d = Math.hypot(s.y - px, s.x - py);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0 && best !== fromIdx && bestD < 17) requestSwap(fromIdx, best);
  }

  const meterEntries = slots.map((s, i) => ({ card: lineup[i], pos: s.pos }));
  const meters: [string, number | null][] = [
    ["ATA", sectorOvr(meterEntries, "ATT")],
    ["MEI", sectorOvr(meterEntries, "MID")],
    ["DEF", sectorOvr(meterEntries, "DEF")],
  ];

  const shareData: ShareCardData = {
    squadName: userTeamName(c),
    coachName: c.coachName,
    formation: c.tactics.formation,
    mentality: c.tactics.mentality,
    slots,
    lineup,
    teamOvr,
    meters,
  };

  async function generateShare() {
    const node = shareRef.current;
    if (!node || sharing) return;
    setSharing(true);
    sound.play("ui.stamp");
    try {
      const url = await toPng(node, { pixelRatio: 2, width: 1080, height: 1920, cacheBust: true, backgroundColor: "#0F3D22" });
      setShareUrl(url);
    } catch {
      sound.play("ui.error");
    } finally {
      setSharing(false);
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      const blob = await (await fetch(shareUrl)).blob();
      const file = new File([blob], "futbattle-escalacao.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: userTeamName(c) });
        return;
      }
    } catch { /* cancelled or unsupported — fall through to download */ }
    const a = document.createElement("a");
    a.href = shareUrl;
    a.download = "futbattle-escalacao.png";
    a.click();
  }

  return (
    <main className="arc-bg flex-1 w-full">
      <div className="mx-auto max-w-6xl w-full px-3 sm:px-4 py-5">

        {/* faixa de status + CTA */}
        <div className="flex flex-wrap items-stretch gap-3 mb-5">
          <div className="arc-strip flex-1 min-w-[260px] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
            <div className="flex items-baseline gap-3 min-w-0">
              <span className="font-display text-2xl tracking-wide leading-none">PRANCHETA</span>
              <span className="hidden md:block font-arc text-[10px] font-bold uppercase tracking-[0.18em] opacity-65 truncate">
                Seleção {c.coachName}
              </span>
            </div>
            <div className="flex items-center gap-4 font-arc font-extrabold uppercase">
              <span><b className="font-display text-lg" style={{ color: "var(--amarelo)" }}>{teamOvr}</b><span className="text-[10px] opacity-65"> força</span></span>
              {meters.map(([label, v]) => (
                <span key={label}><b className="font-display text-lg" style={{ color: METER_COLOR[label] }}>{v ?? "—"}</b><span className="text-[10px] opacity-65"> {label}</span></span>
              ))}
            </div>
          </div>
          <button
            data-sound="confirm"
            onClick={generateShare}
            disabled={sharing}
            className="arc-btn arc-btn--paper arc-btn--card px-5 py-2"
          >
            <span className="block text-base leading-tight">{sharing ? "Gerando…" : "Compartilhar"}</span>
            <span className="block font-arc text-[10px] font-bold opacity-70 mt-0.5">escalação pros stories</span>
          </button>
          <button
            data-sound="confirm"
            onClick={() => { if (!c.cup) c.startCup(); router.push("/cup"); }}
            className="arc-btn arc-btn--rosa arc-btn--card px-6 py-2"
          >
            <span className="block text-lg leading-tight">{c.cup ? "Bora pro jogo" : "Sortear a copa"}</span>
            <span className="block font-arc text-[10px] font-bold opacity-80 mt-0.5">
              {c.cup ? "a copa te espera, mister" : "48 seleções, 12 grupos, uma taça"}
            </span>
          </button>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
          {/* campo */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="arc-tag">★ Formação</span>
              {FORMATION_IDS.map((f) => (
                <button
                  key={f}
                  data-sound="confirm"
                  onClick={() => { c.setFormation(f as FormationId); setSelIdx(null); }}
                  className={`arc-btn px-2.5 py-1 text-[11px] ${c.tactics.formation === f ? "" : "arc-btn--paper"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div ref={pitchRef} className="relative rounded-[22px] border-[3px] border-[var(--ink)] shadow-[5px_6px_0_var(--ink)] overflow-hidden max-w-[560px] mx-auto lg:mx-0">
              <Pitch className="pitch-arc aspect-[3/4] w-full !rounded-none">
                {slots.map((slot, i) => {
                  const card = lineup[i];
                  return (
                    <div
                      key={`${c.tactics.formation}-${i}`}
                      className={`absolute -translate-x-1/2 translate-y-1/2 transition-[left,bottom] duration-500 ease-out ${dragIdx === i ? "z-40" : "z-10"}`}
                      style={{ left: `${slot.y}%`, bottom: `${slot.x}%`, transitionDelay: `${i * 25}ms` }}
                    >
                      {card ? (
                        <motion.div
                          drag
                          dragMomentum={false}
                          dragSnapToOrigin
                          dragElastic={0.06}
                          whileDrag={{ scale: 1.2 }}
                          onDragStart={() => setDragIdx(i)}
                          onDragEnd={(_, info) => { setDragIdx(null); onDragEnd(i, info.point); }}
                          onClick={() => clickLineup(i)}
                          className="cursor-grab active:cursor-grabbing"
                        >
                          <ManageChip
                            card={card}
                            pos={slot.pos}
                            selected={selIdx === i}
                            morale={c.morale[card.player.id] ?? 70}
                            dragging={dragIdx === i}
                          />
                        </motion.div>
                      ) : (
                        <button onClick={() => { sound.play("ui.confirm"); setSelIdx(i); }} className="flex flex-col items-center">
                          <div className={`w-11 h-11 rounded-full border-[3px] border-dashed flex items-center justify-center font-display text-lg ${
                            selIdx === i ? "border-[var(--amarelo)] text-[var(--amarelo)]" : "border-white/55 bg-black/25 text-white/65"
                          }`}>
                            +
                          </div>
                          <span className="mt-1 font-arc text-[9px] font-extrabold uppercase bg-black/55 text-white/85 rounded-full px-1.5 py-px">
                            {POSITION_SHORT[slot.pos]}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </Pitch>
            </div>
            <p className="font-arc text-[10px] font-bold uppercase tracking-wider text-white/70 mt-2 text-center lg:text-left">
              arrasta um jogador em cima do outro (ou do banco) pra trocar — ou toca em dois
            </p>
          </div>

          {/* lateral: banco + tática */}
          <div className="space-y-4">
            <div className="arc-panel px-3.5 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="arc-tag">★ Banco</span>
                <span className="font-arc text-[9px] font-extrabold uppercase tracking-wider opacity-50">
                  {selIdx !== null ? "toca num reserva pra trocar" : "toca num titular primeiro"}
                </span>
              </div>
              <div className="space-y-1.5">
                {bench.map((card, i) => (
                  <button
                    key={card.player.id}
                    ref={(el) => { benchRowRefs.current[i] = el; }}
                    data-sound={selIdx !== null ? undefined : "error"}
                    onClick={() => clickBench(card)}
                    className={`w-full flex items-center gap-2 rounded-xl border-[2.5px] px-2 py-1.5 text-left transition-all ${
                      selIdx !== null
                        ? "border-[var(--ink)] bg-[var(--lima)] hover:translate-x-0.5"
                        : "border-[rgba(20,21,18,0.25)] bg-transparent opacity-75"
                    }`}
                  >
                    <span className="font-display text-lg w-7 text-center shrink-0 text-[var(--ink)]">{card.player.ovr}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-arc text-[12px] font-extrabold uppercase truncate text-[var(--ink)]">{card.player.name}</span>
                      <span className="block font-arc text-[9px] font-bold uppercase opacity-55 text-[var(--ink)]">{card.flag} {card.year}</span>
                    </span>
                    <span className="flex gap-1 shrink-0">
                      {card.player.positions.slice(0, 2).map((p) => <ArcPos key={p} pos={p} />)}
                    </span>
                  </button>
                ))}
                {bench.length === 0 && <p className="font-arc text-xs font-bold opacity-55 px-1 py-2">Banco vazio, mister.</p>}
              </div>
            </div>

            <div className="arc-panel px-3.5 py-3">
              <span className="arc-tag mb-2.5">★ Tática</span>
              <div className="mt-2.5">
                <div className="font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1.5">Mentalidade</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
                    <button
                      key={m}
                      data-sound="tab"
                      onClick={() => c.setTactics({ mentality: m })}
                      className={`arc-btn arc-btn--card py-1.5 text-[11px] ${
                        c.tactics.mentality === m
                          ? m === "ofensivo" ? "arc-btn--rosa" : m === "defensivo" ? "arc-btn--ciano" : "arc-btn--lima"
                          : "arc-btn--paper"
                      }`}
                    >
                      {MENTALITY_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3">
                <div className="font-arc text-[9px] font-extrabold uppercase tracking-widest opacity-50 mb-1.5">Estilo de jogo</div>
                <div className="space-y-1.5">
                  {(Object.keys(STYLE_LABEL) as GameStyle[]).map((s) => (
                    <button
                      key={s}
                      data-sound="confirm"
                      onClick={() => c.setTactics({ style: s })}
                      className={`w-full text-left rounded-xl border-[2.5px] px-2.5 py-1.5 transition-colors ${
                        c.tactics.style === s
                          ? "border-[var(--ink)] bg-[var(--amarelo)]"
                          : "border-[rgba(20,21,18,0.25)] hover:border-[var(--ink)]"
                      }`}
                    >
                      <span className="block font-arc text-[12px] font-extrabold uppercase text-[var(--ink)]">{STYLE_LABEL[s]}</span>
                      <span className="block font-arc text-[10px] font-semibold opacity-60 text-[var(--ink)]">{STYLE_DESC[s]}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* cross-sector swap confirm */}
        <AnimatePresence>
          {confirmSwap && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70"
            >
              <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="arc-panel p-6 max-w-sm w-full text-center">
                <div className="font-display text-3xl mb-2 text-[var(--ink)]">CERTEZA DISSO, MISTER?</div>
                <p className="font-arc text-sm font-bold opacity-65 mb-4 text-[var(--ink)]">
                  Essa troca deixa gente jogando fora do setor — o rendimento despenca
                  (até −9 de OVR, −20 se envolver o goleiro).
                </p>
                <div className="flex gap-3">
                  <button data-sound="cancel" onClick={() => setConfirmSwap(null)} className="arc-btn arc-btn--paper flex-1 py-2.5 text-sm">Melhor não</button>
                  <button
                    data-sound="confirm"
                    onClick={() => { c.swapLineup(confirmSwap.a, confirmSwap.b); setConfirmSwap(null); }}
                    className="arc-btn arc-btn--rosa flex-1 py-2.5 text-sm"
                  >
                    Eu que mando
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* off-screen card the rasterizer captures (kept rendered, not display:none) */}
        <div style={{ position: "fixed", left: -10000, top: 0, pointerEvents: "none", zIndex: -1 }} aria-hidden>
          <ShareCard ref={shareRef} data={shareData} />
        </div>

        {/* share preview modal */}
        <AnimatePresence>
          {shareUrl && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
              onClick={() => setShareUrl(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 14 }} animate={{ scale: 1, y: 0 }}
                className="arc-panel flex w-full max-w-xs flex-col items-center p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="arc-tag mb-3">★ Escalação pronta</span>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shareUrl} alt="Card da escalação" className="w-full rounded-xl border-[3px] border-[var(--ink)] shadow-[3px_4px_0_var(--ink)]" />
                <div className="mt-4 flex w-full gap-2">
                  <button data-sound="confirm" onClick={nativeShare} className="arc-btn arc-btn--lima flex-1 py-2.5 text-sm">
                    Compartilhar
                  </button>
                  <button data-sound="cancel" onClick={() => setShareUrl(null)} className="arc-btn arc-btn--paper px-4 py-2.5 text-sm">
                    Fechar
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
