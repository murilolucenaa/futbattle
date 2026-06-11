"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import Pitch from "@/components/Pitch";
import PressConference from "@/components/PressConference";
import SfxRoot from "@/components/game/SfxRoot";
import { useCareer, allCards, cardById, BENCH_SIZE } from "@/lib/game/store";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL, STYLE_DESC } from "@/lib/game/tactics";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { SQUADS, SQUAD_BY_ID, squadLabel } from "@/lib/data/squads";
import { drawSquad, squadPower } from "@/lib/game/rules";
import {
  sfxClick, sfxStamp, sfxError, sfxDrumroll, sfxTick, sfxReveal,
  vibrate, isMuted, setMuted,
} from "@/lib/sfx";
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
      <SfxRoot />
      <TopBar />
      {c.draftDone ? <ManageView /> : <DraftView />}
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

function ArcPos({ pos, dim }: { pos: Position; dim?: boolean }) {
  return (
    <span
      className="font-arc font-extrabold text-[9px] leading-none px-1.5 py-[2.5px] rounded-md border-2 border-[var(--ink)] uppercase"
      style={{ background: SECTOR_ARC_BG[POSITION_SECTOR[pos]], color: "var(--ink)", opacity: dim ? 0.35 : 1 }}
    >
      {POSITION_SHORT[pos]}
    </span>
  );
}

function DiceIcon({ size = 64, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect x="4" y="4" width="56" height="56" rx="13" fill="var(--paper)" stroke="var(--ink)" strokeWidth="4.5" />
      {[[19, 19], [45, 19], [32, 32], [19, 45], [45, 45]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="5.2" fill="var(--ink)" />
      ))}
    </svg>
  );
}

function powerTier(p: number): { label: string; color: string } {
  if (p >= 90) return { label: "ELENCO LENDÁRIO", color: "var(--rosa)" };
  if (p >= 86) return { label: "PESADÍSSIMO", color: "var(--laranja)" };
  if (p >= 82) return { label: "RESPEITÁVEL", color: "var(--amarelo)" };
  return { label: "TIME DE GUERREIROS", color: "var(--ciano)" };
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

  const drafted = allCards(c).length;
  const total = 11 + BENCH_SIZE;
  const startersDone = c.slots.every((s) => s.card);
  const allDone = startersDone && c.benchSlots.every((b) => b.card);

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
    sfxDrumroll(1.2);
    let n = 0;
    const spin = () => {
      setFlicker(pool[Math.floor(Math.random() * pool.length)]);
      sfxTick();
      n++;
      if (n < 13) {
        timers.current.push(setTimeout(spin, 55 + n * 16));
      } else {
        timers.current.push(setTimeout(() => {
          setSquad(target);
          setFlicker(null);
          setPhase("squad");
          sfxReveal();
          vibrate(24);
        }, 240));
      }
    };
    spin();
  }

  /** Full roll: any nation, any year (weighted by squad power). */
  function roll() {
    if (!canRoll) return;
    const pool = SQUADS.filter((s) => usable(s).length > 0);
    const target = drawSquad(pool, { excludeId: c.draftDraw.squadId ?? undefined });
    if (!target) return;
    if (!rollIsFree) c.spendReroll();
    c.setDraftDraw({ squadId: target.id, used: false, freeRoll: false });
    runSpin(SQUADS, target);
  }

  /** Same nation, random OTHER year — you don't get to pick which. */
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

  /** Different nation, SAME year (nearest year as fallback). */
  const yearPool = useMemo(() => {
    if (!squad) return [];
    const same = SQUADS.filter((s) => s.year === squad.year && s.nation !== squad.nation && usable(s).length > 0);
    if (same.length > 0) return same;
    const others = SQUADS.filter((s) => s.nation !== squad.nation && usable(s).length > 0);
    if (others.length === 0) return [];
    const minD = Math.min(...others.map((s) => Math.abs(s.year - squad.year)));
    return others.filter((s) => Math.abs(s.year - squad.year) === minD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [squad, c.slots, c.benchSlots]);
  function rollSameYear() {
    if (!squad || squadUsed || c.rerollsLeft <= 0 || yearPool.length === 0) return;
    const target = drawSquad(yearPool) ?? yearPool[0];
    c.spendReroll();
    c.setDraftDraw({ squadId: target.id, used: false, freeRoll: false });
    runSpin(yearPool.length > 1 ? yearPool : SQUADS, target);
  }

  function makeCard(p: PlayerDef): Card {
    return { player: p, squadId: squad!.id, nation: squad!.nation, year: squad!.year, flag: squad!.flag };
  }

  function afterPlace(name: string) {
    setPicked(null);
    c.setDraftDraw({ used: true, freeRoll: true });
    sfxStamp();
    vibrate(24);
    showToast(`${name.toUpperCase()} TÁ ESCALADO!`);
  }

  function placeStarter(i: number) {
    if (!picked || c.slots[i].card) return;
    if (!picked.positions.includes(c.slots[i].pos)) { sfxError(); return; }
    c.fillSlot(i, makeCard(picked));
    afterPlace(picked.name);
  }

  function placeBench(i: number) {
    if (!picked || !startersDone || c.benchSlots[i].card) return;
    c.fillBench(i, makeCard(picked));
    afterPlace(picked.name);
  }

  const roster = squad
    ? [...squad.players].sort((a, b) => {
        const d = POSITION_ORDER.indexOf(a.positions[0]) - POSITION_ORDER.indexOf(b.positions[0]);
        return d !== 0 ? d : b.ovr - a.ovr;
      })
    : [];

  const ed = EDITION_BY_ID[c.editionId];

  return (
    <main className="arc-bg flex-1 w-full">
      <div className="mx-auto max-w-6xl w-full px-3 sm:px-4 py-5">

        {/* ── Faixa de status ── */}
        <div className="arc-strip px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 mb-5">
          <div className="flex items-baseline gap-3 min-w-0">
            <span className="font-display text-2xl tracking-wide leading-none">CONVOCAÇÃO</span>
            <span className="hidden md:block font-arc text-[10px] font-bold uppercase tracking-[0.18em] opacity-65 truncate">
              Seleção {c.coachName}{ed ? ` · ${editionLabel(ed)}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-4 font-arc font-extrabold text-sm uppercase">
            <span><b className="font-display text-lg" style={{ color: "var(--rosa)" }}>{drafted}</b><span className="text-[10px] opacity-65">/{total} no grupo</span></span>
            <span><b className="font-display text-lg" style={{ color: "var(--amarelo)" }}>{c.rerollsLeft}</b><span className="text-[10px] opacity-65"> giros</span></span>
            <button
              data-sfx="click"
              onClick={() => { const m = !muted; setMuted(m); setMutedState(m); }}
              className="text-[10px] tracking-widest border-2 border-[rgba(255,253,245,0.4)] rounded-full px-2.5 py-1"
              style={{ color: muted ? "var(--rosa)" : "var(--ciano)" }}
            >
              {muted ? "SOM OFF" : "SOM ON"}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_390px] gap-5 items-start">

          {/* ── ESQUERDA: meu plantel ── */}
          <div className="order-2 lg:order-1">
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="arc-tag">★ Formação</span>
              {FORMATION_IDS.map((f) => (
                <button
                  key={f}
                  data-sfx="click"
                  onClick={() => c.setDraftFormation(f)}
                  className={`arc-btn px-2.5 py-1 text-[11px] ${c.draftFormation === f ? "" : "arc-btn--paper"}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="rounded-[22px] border-[3px] border-[var(--ink)] shadow-[5px_6px_0_var(--ink)] overflow-hidden">
              <Pitch className="pitch-arc aspect-[3/4] w-full !rounded-none">
                {slots.map((slot, i) => {
                  const card = c.slots[i].card;
                  const ok = picked !== null && !card && picked.positions.includes(slot.pos);
                  return (
                    <div
                      key={i}
                      className="absolute -translate-x-1/2 translate-y-1/2"
                      style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
                    >
                      {card ? (
                        <div className={`flex flex-col items-center stamp-in ${picked ? "opacity-35 grayscale" : ""}`}>
                          <div className="relative w-12 h-12 rounded-full border-[3px] border-[var(--ink)] bg-[var(--paper)] flex items-center justify-center font-display text-base text-[var(--ink)] shadow-[2px_3px_0_var(--ink)]">
                            {card.player.ovr}
                            <span className="absolute -top-2 -right-2 text-sm drop-shadow">{card.flag}</span>
                          </div>
                          <span className="mt-1 font-arc text-[10px] font-extrabold uppercase bg-[var(--ink)] text-[var(--paper)] rounded-full px-2 py-0.5 max-w-[88px] truncate">
                            {shortName(card.player.name)}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => { if (ok) placeStarter(i); else if (picked) sfxError(); }}
                          className={`flex flex-col items-center ${ok ? "" : picked ? "cursor-not-allowed" : "cursor-default"}`}
                        >
                          <div className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center font-display text-xl transition-colors ${
                            ok
                              ? "border-[var(--ink)] bg-[var(--lima)] text-[var(--ink)] slot-call"
                              : picked
                                ? "border-[var(--ink)] bg-[#A8AC9C] text-[var(--ink)] opacity-45"
                                : "border-dashed border-white/55 bg-black/25 text-white/65"
                          }`}>
                            +
                          </div>
                          <span className={`mt-1 font-arc text-[10px] font-extrabold uppercase rounded-full px-2 py-0.5 ${
                            ok ? "bg-[var(--lima)] text-[var(--ink)] border-2 border-[var(--ink)]" : "bg-black/55 text-white/85"
                          }`}>
                            {POSITION_SHORT[slot.pos]}
                          </span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </Pitch>
            </div>

            {/* banco */}
            <div className="arc-panel px-4 py-3 mt-4">
              <div className="flex items-center justify-between mb-2.5">
                <span className="arc-tag">★ Banco</span>
                {!startersDone && (
                  <span className="font-arc text-[10px] font-extrabold uppercase tracking-wider opacity-55">
                    fecha os 11 primeiro, mister
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {c.benchSlots.map((b, i) => {
                  const ok = picked !== null && benchOpen && !b.card;
                  return b.card ? (
                    <div key={i} className={`stamp-in flex items-center gap-2 rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--paper)] px-2 py-1.5 ${picked ? "opacity-40 grayscale" : ""}`}>
                      <span className="font-display text-lg text-[var(--ink)]">{b.card.player.ovr}</span>
                      <span className="min-w-0">
                        <span className="block font-arc text-[11px] font-extrabold uppercase truncate text-[var(--ink)]">{shortName(b.card.player.name)}</span>
                        <span className="block font-arc text-[9px] font-bold uppercase opacity-55 text-[var(--ink)]">{b.card.flag} {b.card.year}</span>
                      </span>
                    </div>
                  ) : (
                    <button
                      key={i}
                      onClick={() => { if (ok) placeBench(i); else if (picked) sfxError(); }}
                      className={`rounded-2xl border-[3px] px-2 py-2 font-arc text-[11px] font-extrabold uppercase tracking-wide transition-colors ${
                        ok
                          ? "border-[var(--ink)] bg-[var(--lima)] text-[var(--ink)] slot-call"
                          : !startersDone
                            ? "border-dashed border-[rgba(20,21,18,0.3)] text-[rgba(20,21,18,0.35)] cursor-not-allowed"
                            : picked
                              ? "border-[var(--ink)] bg-[#A8AC9C] text-[var(--ink)] opacity-45 cursor-not-allowed"
                              : "border-dashed border-[rgba(20,21,18,0.4)] text-[rgba(20,21,18,0.5)]"
                      }`}
                    >
                      {!startersDone ? "—" : `+ reserva ${i + 1}`}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── DIREITA: painel do sorteio ── */}
          <div className="order-1 lg:order-2 arc-panel p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="arc-tag">★ Sorteio</span>
              <span className="font-arc text-[10px] font-extrabold uppercase tracking-widest opacity-55">
                {c.rerollsLeft} {c.rerollsLeft === 1 ? "giro extra" : "giros extras"}
              </span>
            </div>

            {allDone ? (
              <div className="text-center py-5">
                <div className="font-display text-4xl text-[var(--ink)] leading-none mb-1.5">GRUPO FECHADO!</div>
                <p className="font-arc text-sm font-bold opacity-65 mb-5">15 lendas no vestiário. Agora é contigo.</p>
                <button
                  data-sfx="confirm"
                  onClick={() => c.completeDraft()}
                  className="arc-btn arc-btn--rosa arc-btn--card w-full py-4"
                >
                  <span className="block text-xl leading-tight">Fechar convocação</span>
                  <span className="block font-arc text-[11px] font-bold opacity-80 mt-0.5">sem choro depois, mister</span>
                </button>
              </div>
            ) : phase === "idle" ? (
              <div className="text-center py-6">
                <DiceIcon size={84} className="mx-auto mb-4 drop-shadow-[3px_4px_0_rgba(20,21,18,0.85)]" />
                <div className="font-display text-4xl text-[var(--ink)] leading-none">BORA CONVOCAR</div>
                <p className="font-arc text-sm font-bold opacity-65 mt-1.5 mb-5">o dado escolhe a seleção, você escolhe o craque</p>
                <button data-sfx="dice" onClick={roll} className="arc-btn arc-btn--lima arc-btn--card w-full py-4">
                  <span className="block text-2xl leading-tight">Roda o dado</span>
                  <span className="block font-arc text-[11px] font-bold opacity-75 mt-0.5">sai uma seleção histórica inteira, vai na fé</span>
                </button>
              </div>
            ) : phase === "rolling" ? (
              <div className="text-center py-9">
                <div className="dice-tumble inline-block mb-5"><DiceIcon size={84} /></div>
                <div className="font-display text-2xl text-[var(--ink)] h-8">
                  {flicker ? `${flicker.flag} ${squadLabel(flicker)}` : "…"}
                </div>
                <div className="font-arc text-[11px] font-extrabold uppercase tracking-[0.3em] opacity-55 mt-2">sorteando…</div>
              </div>
            ) : squad ? (
              <div>
                {/* seleção sorteada */}
                <div className="reveal-pop rounded-2xl border-[3px] border-[var(--ink)] bg-[var(--ink)] text-[var(--paper)] px-4 py-3 flex items-center gap-3">
                  <span className="text-4xl drop-shadow">{squad.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-none truncate">{squad.nation} {squad.year}</span>
                    <span className="block font-arc text-[10px] font-extrabold uppercase tracking-widest mt-1" style={{ color: powerTier(squadPower(squad)).color }}>
                      {powerTier(squadPower(squad)).label} · média {Math.round(squadPower(squad))}
                    </span>
                  </span>
                </div>

                {/* estado do draw */}
                {squadUsed ? (
                  <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--amarelo)] px-3 py-2 mt-3 font-arc text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
                    Tá escalado! Roda o dado pra próxima vaga — esse é de graça.
                  </div>
                ) : deadSquad ? (
                  <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--laranja)] px-3 py-2 mt-3 font-arc text-[11px] font-extrabold uppercase tracking-wide text-[#FFF9EE]">
                    Ninguém aqui serve pras vagas que sobraram. Roda de novo — de graça.
                  </div>
                ) : picked ? (
                  <div className="rounded-xl border-[3px] border-[var(--ink)] bg-[var(--lima)] px-3 py-2 mt-3 font-arc text-[11px] font-extrabold uppercase tracking-wide text-[var(--ink)]">
                    Agora carimba: clica numa vaga verde no campo ({picked.positions.map((p) => POSITION_SHORT[p]).join(" · ")})
                  </div>
                ) : (
                  <div className="font-arc text-[11px] font-extrabold uppercase tracking-wide opacity-55 px-1 mt-3">
                    Sua vez: clica num craque pra ver onde ele joga
                  </div>
                )}

                {/* elenco completo, do goleiro ao centroavante */}
                <div className="mt-2.5 space-y-1 max-h-[37vh] overflow-y-auto pr-1">
                  {roster.map((p) => {
                    const used = usedNames.has(p.name);
                    const noFit = !used && !fits(p);
                    const can = !used && !noFit && !squadUsed;
                    const isPicked = picked?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        disabled={!can}
                        data-sfx={can ? "click" : undefined}
                        onClick={() => setPicked(isPicked ? null : p)}
                        className={`w-full flex items-center gap-2 rounded-xl border-[2.5px] px-2 py-1.5 text-left transition-colors ${
                          isPicked
                            ? "border-[var(--ink)] bg-[var(--amarelo)]"
                            : can
                              ? "border-[rgba(20,21,18,0.25)] bg-transparent hover:border-[var(--ink)] hover:bg-[rgba(20,21,18,0.05)]"
                              : "border-transparent opacity-35 cursor-not-allowed"
                        }`}
                      >
                        <span className="flex gap-1 shrink-0">
                          {p.positions.map((x) => <ArcPos key={x} pos={x} dim={!can && !isPicked} />)}
                        </span>
                        <span className="min-w-0 flex-1 font-arc text-[13px] font-extrabold truncate text-[var(--ink)]">{p.name}</span>
                        {used && (
                          <span className="font-arc text-[8px] font-extrabold uppercase tracking-wider bg-[var(--ink)] text-[var(--paper)] rounded-full px-1.5 py-0.5 shrink-0">já é seu</span>
                        )}
                        {noFit && (
                          <span className="font-arc text-[8px] font-extrabold uppercase tracking-wider border-2 border-[var(--ink)] rounded-full px-1.5 py-0.5 shrink-0 text-[var(--ink)]">sem vaga</span>
                        )}
                        <span className="font-display text-lg w-8 text-right shrink-0 text-[var(--ink)]">{p.ovr}</span>
                      </button>
                    );
                  })}
                </div>

                {/* ações */}
                <div className="mt-3.5 space-y-2">
                  <button
                    data-sfx="dice"
                    disabled={!canRoll}
                    onClick={roll}
                    className="arc-btn arc-btn--lima arc-btn--card w-full py-3"
                  >
                    <span className="block text-lg leading-tight">Roda o dado</span>
                    <span className="block font-arc text-[10px] font-bold opacity-75 mt-0.5">
                      {rollIsFree ? "esse é de graça" : c.rerollsLeft > 0 ? `custa 1 giro · sobram ${c.rerollsLeft}` : "acabaram os giros — escolhe alguém aí"}
                    </span>
                  </button>
                  {!squadUsed && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        data-sfx="dice"
                        disabled={c.rerollsLeft <= 0 || genPool.length === 0}
                        onClick={rollGeneration}
                        className="arc-btn arc-btn--ciano arc-btn--card py-2.5"
                      >
                        <span className="block text-sm leading-tight">Mudar geração</span>
                        <span className="block font-arc text-[9px] font-bold opacity-70 mt-0.5">
                          {squad.nation} de outro ano · −1 giro
                        </span>
                      </button>
                      <button
                        data-sfx="dice"
                        disabled={c.rerollsLeft <= 0 || yearPool.length === 0}
                        onClick={rollSameYear}
                        className="arc-btn arc-btn--laranja arc-btn--card py-2.5"
                      >
                        <span className="block text-sm leading-tight">Outra seleção</span>
                        <span className="block font-arc text-[9px] font-bold opacity-70 mt-0.5">
                          mesma época, sorte de novo · −1 giro
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* toast carimbo */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, scale: 1.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: -2 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 500, damping: 24 }}
              className="fixed bottom-7 left-1/2 -translate-x-1/2 z-50 font-display text-lg px-6 py-2.5 rounded-full border-[3px] border-[var(--ink)] bg-[var(--amarelo)] text-[var(--ink)] shadow-[5px_6px_0_var(--ink)]"
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
  const slots = FORMATIONS[c.tactics.formation];
  const lineup = c.lineupIds.map((id) => cardById(c, id));
  const bench = c.benchIds.map((id) => cardById(c, id)).filter((x): x is Card => !!x);
  const [selIdx, setSelIdx] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [confirmSwap, setConfirmSwap] = useState<{ a: number; b: number } | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);

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
    else { sfxStamp(); vibrate(12); c.swapLineup(a, b); }
  }

  function clickLineup(i: number) {
    sfxClick();
    if (selIdx === null) setSelIdx(i);
    else if (selIdx === i) setSelIdx(null);
    else { requestSwap(selIdx, i); setSelIdx(null); }
  }
  function clickBench(card: Card) {
    if (selIdx === null) return;
    sfxStamp();
    vibrate(12);
    c.swapWithBench(selIdx, card.player.id);
    setSelIdx(null);
  }

  // drag a chip near another slot to swap — centering transform lives on the
  // wrapper, framer only animates the inner node (no transform fights)
  function onDragEnd(fromIdx: number, point: { x: number; y: number }) {
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
            data-sfx="confirm"
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
                  data-sfx="click"
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
                      className={`absolute -translate-x-1/2 translate-y-1/2 ${dragIdx === i ? "z-40" : "z-10"}`}
                      style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
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
                        <button onClick={() => { sfxClick(); setSelIdx(i); }} className="flex flex-col items-center">
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
              arrasta um jogador em cima do outro pra trocar — ou toca em dois
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
                {bench.map((card) => (
                  <button
                    key={card.player.id}
                    data-sfx={selIdx !== null ? undefined : "error"}
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
                      data-sfx="click"
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
                      data-sfx="click"
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
                  <button data-sfx="back" onClick={() => setConfirmSwap(null)} className="arc-btn arc-btn--paper flex-1 py-2.5 text-sm">Melhor não</button>
                  <button
                    data-sfx="confirm"
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
      </div>
    </main>
  );
}
