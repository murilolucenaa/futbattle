"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import Pitch from "@/components/Pitch";
import RouletteModal from "@/components/RouletteModal";
import PressConference from "@/components/PressConference";
import { useCareer, allCards, cardById, BENCH_SIZE } from "@/lib/game/store";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL, STYLE_DESC } from "@/lib/game/tactics";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { sfxBack, sfxConfirm, sfxMove } from "@/lib/sfx";
import { IconArrow, IconDice, IconTrophy } from "@/components/icons";
import type { Card, FormationId, GameStyle, Mentality, Position, Sector } from "@/lib/game/types";
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

function SectorMeters({ entries }: { entries: { card: Card | null; pos: Position }[] }) {
  const groups: [string, Sector][] = [["ATA", "ATT"], ["MEI", "MID"], ["DEF", "DEF"]];
  return (
    <div className="flex gap-2">
      {groups.map(([label, sec]) => {
        const v = sectorOvr(entries, sec);
        const color = v === null ? "var(--muted)" : v >= 88 ? "var(--accent)" : v >= 82 ? "var(--gold)" : "var(--red)";
        return (
          <div key={label} className="glass px-3 py-2 text-center min-w-[64px]">
            <div className="font-display text-xl transition-colors" style={{ color }}>{v ?? "—"}</div>
            <div className="h-1 rounded-full bg-[var(--surface-2)] overflow-hidden my-1">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${v ? Math.max(8, (v - 70) * (100 / 29)) : 0}%`, background: color }} />
            </div>
            <div className="text-[9px] uppercase tracking-wider text-[var(--muted)]">{label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Small pieces ─────────────────────────────────────────────
function PlayerChip({
  card, pos, selected, dimmed, onClick, size = "md", morale,
}: {
  card: Card; pos?: Position; selected?: boolean; dimmed?: boolean;
  onClick?: () => void; size?: "sm" | "md"; morale?: number;
}) {
  const eff = pos ? effectiveOvr(card, pos) : card.player.ovr;
  const penalized = pos ? eff < card.player.ovr : false;
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center transition-transform ${onClick ? "hover:scale-105" : ""} ${dimmed ? "opacity-40" : ""}`}
    >
      <div className={`relative rounded-full flex items-center justify-center font-display border-2 transition-shadow ${
        size === "sm" ? "w-10 h-10 text-sm" : "w-12 h-12 text-base"
      } ${selected
          ? "border-[var(--gold)] shadow-[0_0_16px_rgba(255,197,61,0.6)]"
          : penalized ? "border-[var(--red)]" : "border-[var(--accent)]"
      } bg-[var(--bg-2)]`}>
        <span className={penalized ? "text-[var(--red)]" : "text-white"}>{eff}</span>
        <span className="absolute -top-1.5 -right-1.5 text-sm">{card.flag}</span>
        {morale !== undefined && (
          <span
            className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-[3px] w-7 rounded-full overflow-hidden bg-black/50"
            title={`Moral ${morale}`}
          >
            <span className="block h-full" style={{ width: `${morale}%`, background: morale >= 70 ? "var(--accent)" : morale >= 45 ? "var(--gold)" : "var(--red)" }} />
          </span>
        )}
      </div>
      <span className="mt-1 text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5 max-w-[84px] truncate">
        {shortName(card.player.name)}
      </span>
      {pos && <span className="text-[9px] text-white/60 font-semibold">{POSITION_SHORT[pos]}</span>}
    </button>
  );
}

function EmptySlot({ pos, onClick, highlight }: { pos: Position; onClick: () => void; highlight?: boolean }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center group">
      <div className={`w-12 h-12 rounded-full border-2 border-dashed flex items-center justify-center transition-colors ${
        highlight
          ? "border-[var(--accent)] text-[var(--accent)] animate-pulse-ring bg-[rgba(0,255,135,0.12)]"
          : "border-white/40 bg-black/30 text-white/60 group-hover:border-[var(--accent)] group-hover:text-[var(--accent)]"
      }`}>
        +
      </div>
      <span className="mt-1 text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">{POSITION_SHORT[pos]}</span>
    </button>
  );
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
      <TopBar />
      {c.draftDone ? <ManageView /> : <DraftView />}
    </>
  );
}

// ── DRAFT MODE ───────────────────────────────────────────────
function DraftView() {
  const c = useCareer();
  const slots = FORMATIONS[c.draftFormation];
  const [rolling, setRolling] = useState<null | { kind: "slot" | "bench"; index: number }>(null);
  const [placing, setPlacing] = useState<Card | null>(null);
  const [confirmPlace, setConfirmPlace] = useState<{ card: Card; index: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const drafted = allCards(c).length;
  const total = 11 + BENCH_SIZE;
  const startersDone = c.slots.every((s) => s.card);
  const allDone = startersDone && c.benchSlots.every((b) => b.card);

  const usedNames = useMemo(
    () => new Set(allCards(c).map((x) => x.player.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.slots, c.benchSlots]
  );

  // bench phase grants +1 spin, once
  useEffect(() => {
    if (startersDone && !c.benchBonusGranted) {
      c.grantBenchBonus();
      setToast("Convocação dos titulares fechada — bônus de banco: +1 giro!");
      setTimeout(() => setToast(null), 3000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startersDone, c.benchBonusGranted]);

  function handlePick(card: Card) {
    if (!rolling) return;
    if (rolling.kind === "bench") {
      c.fillBench(rolling.index, card);
      setRolling(null);
      return;
    }
    // starter: if the slot that opened the roulette fits, place directly
    const slotPos = c.slots[rolling.index].pos;
    setRolling(null);
    if (card.player.positions.includes(slotPos) && !c.slots[rolling.index].card) {
      c.fillSlot(rolling.index, card);
    } else {
      setPlacing(card); // choose a spot on the pitch
    }
  }

  function placeAt(index: number) {
    if (!placing || c.slots[index].card) return;
    const pos = c.slots[index].pos;
    if (placing.player.positions.includes(pos)) {
      sfxConfirm();
      c.fillSlot(index, placing);
      setPlacing(null);
    } else {
      setConfirmPlace({ card: placing, index });
    }
  }

  const benchCount = c.benchSlots.filter((b) => b.card).length;
  const rouletteTitle = rolling?.kind === "bench"
    ? `Reserva ${benchCount + 1}/${BENCH_SIZE}`
    : rolling
      ? `${POSITION_SHORT[c.slots[rolling.index].pos]} · Titular`
      : "";

  return (
    <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Convocação — Seleção {c.coachName}</h1>
          <p className="text-sm text-[var(--muted)]">
            {EDITION_BY_ID[c.editionId] ? editionLabel(EDITION_BY_ID[c.editionId]) : ""} · Toque numa vaga,
            gire a roleta e escolha <strong>qualquer jogador</strong> da seleção sorteada.
          </p>
        </div>
        <div className="flex gap-2 items-stretch">
          <div className="glass px-4 py-2 text-center">
            <div className="font-display text-2xl text-[var(--accent)]">{drafted}/{total}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">convocados</div>
          </div>
          <div className="glass px-4 py-2 text-center">
            <div className={`font-display text-2xl ${c.rerollsLeft <= 1 ? "text-[var(--red)]" : "text-[var(--gold)]"}`}>{c.rerollsLeft}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">giros</div>
          </div>
          <SectorMeters entries={c.slots.map((s, i) => ({ card: s.card, pos: slots[i].pos }))} />
        </div>
      </div>

      {/* placing banner */}
      <AnimatePresence>
        {placing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-strong p-4 mb-4 flex items-center justify-between gap-3"
          >
            <div className="text-sm">
              <strong className="text-[var(--accent)]">{placing.player.name}</strong> convocado!
              Escolha a posição dele no campo — posições naturais acendem em verde
              ({placing.player.positions.map((p) => POSITION_SHORT[p]).join(" · ")}).
            </div>
            <button onClick={() => { sfxBack(); setPlacing(null); }} className="btn-ghost px-3 py-1.5 text-xs font-bold shrink-0">
              cancelar
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Formation choice during draft */}
      <div className="glass p-3 mb-5 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mr-2">Formação</span>
        {FORMATION_IDS.map((f) => (
          <button
            key={f}
            onClick={() => { sfxMove(); c.setDraftFormation(f); }}
            className={`px-3 py-1.5 rounded-lg font-display text-sm transition-all ${
              c.draftFormation === f
                ? "bg-[var(--accent)] text-[#04130B] shadow-[0_0_14px_rgba(0,255,135,0.35)]"
                : "btn-ghost"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        {/* Pitch */}
        <Pitch className="aspect-[3/4] w-full max-w-md mx-auto lg:max-w-none">
          {slots.map((slot, i) => {
            const card = c.slots[i].card;
            const natural = placing?.player.positions.includes(slot.pos) ?? false;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 translate-y-1/2"
                style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
              >
                {card ? (
                  <PlayerChip card={card} pos={slot.pos} dimmed={placing !== null} />
                ) : placing ? (
                  <EmptySlot pos={slot.pos} highlight={natural} onClick={() => placeAt(i)} />
                ) : (
                  <EmptySlot pos={slot.pos} onClick={() => setRolling({ kind: "slot", index: i })} />
                )}
              </div>
            );
          })}
        </Pitch>

        {/* Side panel: squad list + bench */}
        <div className="space-y-4">
          <div className="glass p-4">
            <h2 className="font-display text-lg mb-2">Plantel</h2>
            <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
              {allCards(c).length === 0 && (
                <p className="text-sm text-[var(--muted)]">Ninguém convocado ainda. Boa coletiva, mister.</p>
              )}
              {allCards(c).map((card) => (
                <div key={card.player.id} className="flex items-center gap-2 text-sm py-1 border-b border-[var(--border)] last:border-0">
                  <span className="font-display w-8 text-center text-[var(--accent)]">{card.player.ovr}</span>
                  <span className="flex-1 truncate font-semibold">{card.flag} {card.player.name}</span>
                  <span className="text-[10px] text-[var(--muted)]">{card.player.positions.map((p) => POSITION_SHORT[p]).join("/")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass p-4">
            <h2 className="font-display text-lg mb-1">Banco de reservas</h2>
            <p className="text-xs text-[var(--muted)] mb-3">
              Libera depois dos 11 titulares — e vem com +1 giro de bônus.
            </p>
            <div className="space-y-2">
              {c.benchSlots.map((b, i) => (
                <div key={i} className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-3">
                  {b.card ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[var(--bg-2)] border border-[var(--accent)] flex items-center justify-center font-display">
                        {b.card.player.ovr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{b.card.flag} {b.card.player.name}</div>
                        <div className="text-[11px] text-[var(--muted)]">
                          {b.card.player.positions.map((p) => POSITION_SHORT[p]).join("/")} · {b.card.nation} {b.card.year}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--muted)]">Reserva {i + 1}</span>
                      <button
                        disabled={!startersDone}
                        onClick={() => setRolling({ kind: "bench", index: i })}
                        className="btn-hero px-4 py-1.5 text-sm disabled:opacity-30 flex items-center gap-1.5"
                      >
                        <IconDice size={14} /> Sortear
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence>
            {allDone && (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => { sfxConfirm(); c.completeDraft(); }}
                className="btn-hero w-full py-4 text-lg"
              >
                Confirmar convocação →
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <RouletteModal
        open={rolling !== null}
        title={rouletteTitle}
        usedNames={usedNames}
        rerollsLeft={c.rerollsLeft}
        onSpendReroll={c.spendReroll}
        onPick={handlePick}
        onClose={() => setRolling(null)}
      />

      {/* out-of-position confirm */}
      <AnimatePresence>
        {confirmPlace && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="glass-strong p-6 max-w-sm w-full text-center">
              <div className="font-display text-2xl mb-2">Certeza disso, mister?</div>
              <p className="text-sm text-[var(--muted)] mb-4">
                {confirmPlace.card.player.name} vai jogar improvisado de{" "}
                <strong className="text-[var(--red)]">{POSITION_SHORT[c.slots[confirmPlace.index].pos]}</strong> — com queda de rendimento.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPlace(null)} className="btn-ghost flex-1 py-2.5 font-bold">Melhor não</button>
                <button
                  onClick={() => { c.fillSlot(confirmPlace.index, confirmPlace.card); setPlacing(null); setConfirmPlace(null); }}
                  className="btn-hero flex-1 py-2.5"
                >
                  Eu que mando
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 glass-strong px-5 py-3 text-sm font-bold z-50"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ── MANAGE MODE (Escalação & Tática — prancheta PES) ─────────
function ManageView() {
  const router = useRouter();
  const c = useCareer();
  const slots = FORMATIONS[c.tactics.formation];
  const lineup = c.lineupIds.map((id) => cardById(c, id));
  const bench = c.benchIds.map((id) => cardById(c, id)).filter((x): x is Card => !!x);
  const [selIdx, setSelIdx] = useState<number | null>(null);
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
    else { sfxConfirm(); c.swapLineup(a, b); }
  }

  function clickLineup(i: number) {
    sfxMove();
    if (selIdx === null) setSelIdx(i);
    else if (selIdx === i) setSelIdx(null);
    else { requestSwap(selIdx, i); setSelIdx(null); }
  }
  function clickBench(card: Card) {
    if (selIdx === null) return;
    sfxConfirm();
    c.swapWithBench(selIdx, card.player.id);
    setSelIdx(null);
  }

  // drag a chip onto another slot to swap (PES prancheta feel)
  function onDragEnd(fromIdx: number, point: { x: number; y: number }) {
    const el = pitchRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = ((point.x - r.left) / r.width) * 100;  // left %
    const py = (1 - (point.y - r.top) / r.height) * 100; // bottom %
    let best = -1, bestD = Infinity;
    slots.forEach((s, i) => {
      const d = Math.hypot(s.y - px, s.x - py);
      if (d < bestD) { bestD = d; best = i; }
    });
    if (best >= 0 && best !== fromIdx && bestD < 14) requestSwap(fromIdx, best);
  }

  return (
    <main className="flex-1 mx-auto max-w-6xl w-full px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Seleção {c.coachName}</h1>
          <p className="text-sm text-[var(--muted)]">
            Arraste um jogador sobre outro para trocar de posição — ou toque em dois. Campo ↔ banco também.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass px-4 py-2 text-center">
            <div className="font-display text-2xl text-[var(--gold)]">{teamOvr}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Força</div>
          </div>
          <SectorMeters entries={slots.map((s, i) => ({ card: lineup[i], pos: s.pos }))} />
          <button
            onClick={() => {
              sfxConfirm();
              if (!c.cup) c.startCup();
              router.push("/cup");
            }}
            className="btn-hero px-6 py-3 flex items-center gap-2"
          >
            <IconTrophy size={18} />
            {c.cup ? "Ir para a Copa" : "Sortear a Copa do Mundo"}
            <IconArrow size={16} />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div>
          <div ref={pitchRef} className="relative">
            <Pitch className="aspect-[3/4] w-full max-w-md mx-auto lg:max-w-none">
              {slots.map((slot, i) => {
                const card = lineup[i];
                return (
                  <motion.div
                    key={`${c.tactics.formation}-${i}-${card?.player.id ?? "x"}`}
                    className="absolute -translate-x-1/2 translate-y-1/2 z-10"
                    style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
                    drag={!!card}
                    dragMomentum={false}
                    dragSnapToOrigin
                    whileDrag={{ scale: 1.15, zIndex: 30 }}
                    onDragEnd={(_, info) => onDragEnd(i, info.point)}
                  >
                    {card ? (
                      <PlayerChip
                        card={card} pos={slot.pos} selected={selIdx === i}
                        morale={c.morale[card.player.id] ?? 70}
                        onClick={() => clickLineup(i)}
                      />
                    ) : (
                      <EmptySlot pos={slot.pos} onClick={() => setSelIdx(i)} />
                    )}
                  </motion.div>
                );
              })}
            </Pitch>
          </div>

          {/* Bench row */}
          <div className="glass p-3 mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Banco</div>
            <div className="flex gap-4 flex-wrap">
              {bench.map((card) => (
                <PlayerChip
                  key={card.player.id}
                  card={card}
                  size="sm"
                  morale={c.morale[card.player.id] ?? 70}
                  dimmed={selIdx === null}
                  onClick={() => clickBench(card)}
                />
              ))}
              {bench.length === 0 && <span className="text-sm text-[var(--muted)]">Banco vazio</span>}
            </div>
          </div>
        </div>

        {/* Tactics panel */}
        <div className="space-y-4">
          <div className="glass p-4">
            <h3 className="font-display text-lg mb-3">Formação</h3>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMATION_IDS.map((f) => (
                <button
                  key={f}
                  onClick={() => { sfxMove(); c.setFormation(f as FormationId); setSelIdx(null); }}
                  className={`py-2 rounded-xl font-display text-sm transition-all ${
                    c.tactics.formation === f
                      ? "bg-[var(--accent)] text-[#04130B]"
                      : "btn-ghost"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="glass p-4">
            <h3 className="font-display text-lg mb-3">Mentalidade</h3>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(MENTALITY_LABEL) as Mentality[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { sfxMove(); c.setTactics({ mentality: m }); }}
                  className={`py-2 rounded-xl text-sm font-bold transition-all ${
                    c.tactics.mentality === m
                      ? m === "ofensivo" ? "bg-[var(--red)] text-white"
                        : m === "defensivo" ? "bg-[var(--blue)] text-white"
                        : "bg-[var(--accent)] text-[#04130B]"
                      : "btn-ghost"
                  }`}
                >
                  {MENTALITY_LABEL[m]}
                </button>
              ))}
            </div>
          </div>

          <div className="glass p-4">
            <h3 className="font-display text-lg mb-3">Estilo de jogo</h3>
            <div className="space-y-2">
              {(Object.keys(STYLE_LABEL) as GameStyle[]).map((s) => (
                <button
                  key={s}
                  onClick={() => { sfxMove(); c.setTactics({ style: s }); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    c.tactics.style === s
                      ? "border-[var(--accent)] bg-[rgba(0,255,135,0.08)]"
                      : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <div className="font-bold text-sm">{STYLE_LABEL[s]}</div>
                  <div className="text-xs text-[var(--muted)]">{STYLE_DESC[s]}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* cross-sector swap confirm */}
      <AnimatePresence>
        {confirmSwap && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="glass-strong p-6 max-w-sm w-full text-center">
              <div className="font-display text-2xl mb-2">Certeza disso, mister?</div>
              <p className="text-sm text-[var(--muted)] mb-4">
                Essa troca deixa gente jogando fora do setor — o rendimento despenca
                (até −9 de OVR, −20 se envolver o goleiro).
              </p>
              <div className="flex gap-3">
                <button onClick={() => { sfxBack(); setConfirmSwap(null); }} className="btn-ghost flex-1 py-2.5 font-bold">Melhor não</button>
                <button
                  onClick={() => { sfxConfirm(); c.swapLineup(confirmSwap.a, confirmSwap.b); setConfirmSwap(null); }}
                  className="btn-hero flex-1 py-2.5"
                >
                  Eu que mando
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
