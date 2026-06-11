"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import Pitch from "@/components/Pitch";
import RouletteModal from "@/components/RouletteModal";
import { useCareer, allCards, cardById, BENCH_SIZE } from "@/lib/game/store";
import { FORMATIONS, FORMATION_IDS, effectiveOvr } from "@/lib/game/formations";
import { MENTALITY_LABEL, STYLE_LABEL, STYLE_DESC } from "@/lib/game/tactics";
import { CAP_CRACK, CAP_ELITE, countCracks, countElite } from "@/lib/game/rules";
import type { Card, FormationId, GameStyle, Mentality, Position } from "@/lib/game/types";
import { POSITION_LABEL } from "@/lib/game/types";

const ALL_POSITIONS: Position[] = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

const SUFFIXES = new Set(["Júnior", "Junior", "Jr.", "Filho", "Santos", "Cézar"]);
function shortName(name: string): string {
  const parts = name.split(" ");
  if (parts.length === 1) return name;
  const last = parts[parts.length - 1];
  return SUFFIXES.has(last) ? parts[0] : last;
}


// ── Small pieces ─────────────────────────────────────────────
function PlayerChip({
  card, pos, selected, dimmed, onClick, size = "md",
}: {
  card: Card; pos?: Position; selected?: boolean; dimmed?: boolean;
  onClick?: () => void; size?: "sm" | "md";
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
      </div>
      <span className="mt-1 text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5 max-w-[84px] truncate">
        {shortName(card.player.name)}
      </span>
      {pos && <span className="text-[9px] text-white/60 font-semibold">{pos}</span>}
    </button>
  );
}

function EmptySlot({ pos, onClick }: { pos: Position; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center group">
      <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/40 bg-black/30 flex items-center justify-center text-white/60 group-hover:border-[var(--accent)] group-hover:text-[var(--accent)] transition-colors animate-pulse-ring">
        +
      </div>
      <span className="mt-1 text-[10px] font-bold bg-black/60 rounded px-1.5 py-0.5">{pos}</span>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function SquadPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);
  const [roll, setRoll] = useState<{ kind: "slot" | "bench"; index: number } | null>(null);
  const [selIdx, setSelIdx] = useState<number | null>(null); // selected lineup index (manage mode)

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && c.teamName === "") router.replace("/");
  }, [mounted, c.teamName, router]);

  const usedNames = useMemo(
    () => new Set(allCards(c).map((x) => x.player.name)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [c.slots, c.benchSlots]
  );

  if (!mounted || c.teamName === "") return null;

  return (
    <>
      <TopBar />
      {c.draftDone ? <ManageView selIdx={selIdx} setSelIdx={setSelIdx} /> : (
        <DraftView roll={roll} setRoll={setRoll} usedNames={usedNames} />
      )}
    </>
  );
}

// ── DRAFT MODE ───────────────────────────────────────────────
function DraftView({
  roll, setRoll, usedNames,
}: {
  roll: { kind: "slot" | "bench"; index: number } | null;
  setRoll: (r: { kind: "slot" | "bench"; index: number } | null) => void;
  usedNames: Set<string>;
}) {
  const c = useCareer();
  const slots = FORMATIONS[c.draftFormation];
  const drafted = allCards(c).length;
  const total = 11 + BENCH_SIZE;
  const startersDone = c.slots.every((s) => s.card);
  const allDone = startersDone && c.benchSlots.every((b) => b.card);
  const noneDrafted = drafted === 0;

  const rollPos: Position | null = roll
    ? roll.kind === "slot"
      ? c.slots[roll.index].pos
      : c.benchSlots[roll.index].pos
    : null;

  const benchUsedPos = new Set(c.benchSlots.map((b) => b.pos).filter(Boolean) as Position[]);

  function handlePick(card: Card) {
    if (!roll) return;
    if (roll.kind === "slot") c.fillSlot(roll.index, card);
    else c.fillBench(roll.index, card);
    setRoll(null);
  }

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">Convocação — {c.teamName}</h1>
          <p className="text-sm text-[var(--muted)]">
            Toque numa posição, gire a roleta e convoque uma lenda. 11 titulares + {BENCH_SIZE} reservas.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="glass px-4 py-2 text-center">
            <div className="font-display text-2xl text-[var(--accent)]">{drafted}/{total}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">convocados</div>
          </div>
          <div className="glass px-4 py-2 text-center">
            <div className={`font-display text-2xl ${c.rerollsLeft <= 2 ? "text-[var(--red)]" : "text-[var(--gold)]"}`}>{c.rerollsLeft}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">giros extras</div>
          </div>
          <div className="glass px-4 py-2 text-center">
            <div className="font-display text-2xl">
              <span className={countCracks(allCards(c)) >= CAP_CRACK ? "text-[var(--red)]" : "text-[var(--gold)]"}>{countCracks(allCards(c))}/{CAP_CRACK}</span>
              <span className="text-[var(--muted)] text-base"> · </span>
              <span className={countElite(allCards(c)) >= CAP_ELITE ? "text-[var(--red)]" : "text-[var(--accent)]"}>{countElite(allCards(c))}/{CAP_ELITE}</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">craques 95+ · elite 90+</div>
          </div>
        </div>
      </div>

      {/* Formation choice (before first pick) */}
      <AnimatePresence>
        {noneDrafted && (
          <motion.div exit={{ opacity: 0, height: 0 }} className="glass p-4 mb-5">
            <p className="text-sm font-semibold mb-3 text-[var(--muted)]">
              Formação base da convocação (você poderá mudar a tática a cada jogo):
            </p>
            <div className="flex flex-wrap gap-2">
              {FORMATION_IDS.map((f) => (
                <button
                  key={f}
                  onClick={() => c.newCareer(c.teamName, f)}
                  className={`px-5 py-2.5 rounded-xl font-display text-lg transition-all ${
                    c.draftFormation === f
                      ? "bg-[var(--accent)] text-[#04130B] shadow-[0_0_20px_rgba(0,255,135,0.4)]"
                      : "btn-ghost"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        {/* Pitch */}
        <Pitch className="aspect-[3/4] w-full max-w-md mx-auto lg:max-w-none">
          {slots.map((slot, i) => {
            const card = c.slots[i].card;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 translate-y-1/2"
                style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
              >
                {card ? (
                  <PlayerChip card={card} pos={slot.pos} />
                ) : (
                  <EmptySlot pos={slot.pos} onClick={() => setRoll({ kind: "slot", index: i })} />
                )}
              </div>
            );
          })}
        </Pitch>

        {/* Bench */}
        <div className="space-y-4">
          <div className="glass p-4">
            <h2 className="font-display text-lg mb-1">Banco de reservas</h2>
            <p className="text-xs text-[var(--muted)] mb-3">
              Escolha a posição de cada reserva — no máximo 1 por posição no banco.
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
                        <div className="text-[11px] text-[var(--muted)]">{POSITION_LABEL[b.pos!]} · {b.card.nation} {b.card.year}</div>
                      </div>
                    </div>
                  ) : b.pos ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold">{POSITION_LABEL[b.pos]}</span>
                      <div className="flex gap-2">
                        <button onClick={() => c.setBenchPos(i, null)} className="text-xs text-[var(--muted)] hover:text-white px-2">trocar</button>
                        <button onClick={() => setRoll({ kind: "bench", index: i })} className="btn-hero px-4 py-1.5 text-sm">
                          🎲 Sortear
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="text-xs font-semibold text-[var(--muted)] mb-2">Reserva {i + 1} — escolha a posição:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {ALL_POSITIONS.map((p) => (
                          <button
                            key={p}
                            disabled={benchUsedPos.has(p)}
                            onClick={() => c.setBenchPos(i, p)}
                            className="btn-ghost px-2.5 py-1 text-xs font-bold disabled:opacity-25"
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Confirm */}
          <AnimatePresence>
            {allDone && (
              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => c.completeDraft()}
                className="btn-hero w-full py-4 text-lg"
              >
                ✅ Confirmar convocação
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <RouletteModal
        open={roll !== null && rollPos !== null}
        pos={rollPos}
        usedNames={usedNames}
        squadCards={allCards(c)}
        rerollsLeft={c.rerollsLeft}
        onSpendReroll={c.spendReroll}
        onPick={handlePick}
        onClose={() => setRoll(null)}
      />
    </main>
  );
}

// ── MANAGE MODE (Escalação & Tática) ─────────────────────────
function ManageView({
  selIdx, setSelIdx,
}: {
  selIdx: number | null; setSelIdx: (i: number | null) => void;
}) {
  const router = useRouter();
  const c = useCareer();
  const slots = FORMATIONS[c.tactics.formation];
  const lineup = c.lineupIds.map((id) => cardById(c, id));
  const bench = c.benchIds.map((id) => cardById(c, id)).filter((x): x is Card => !!x);

  const teamOvr = Math.round(
    lineup.reduce((s, card, i) => s + (card ? effectiveOvr(card, slots[i].pos) : 0), 0) / 11
  );

  function clickLineup(i: number) {
    if (selIdx === null) setSelIdx(i);
    else if (selIdx === i) setSelIdx(null);
    else { c.swapLineup(selIdx, i); setSelIdx(null); }
  }
  function clickBench(card: Card) {
    if (selIdx === null) return;
    c.swapWithBench(selIdx, card.player.id);
    setSelIdx(null);
  }

  return (
    <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-display text-3xl">⭐ {c.teamName}</h1>
          <p className="text-sm text-[var(--muted)]">
            Toque em dois jogadores para trocá-los de posição (campo ↔ banco também).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass px-4 py-2 text-center">
            <div className="font-display text-2xl text-[var(--gold)]">{teamOvr}</div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">Força</div>
          </div>
          <button
            onClick={() => {
              if (!c.cup) c.startCup();
              router.push("/cup");
            }}
            className="btn-hero px-6 py-3"
          >
            {c.cup ? "Ir para a Copa →" : "🏆 Sortear a Copa do Mundo"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-5">
        <div>
          <Pitch className="aspect-[3/4] w-full max-w-md mx-auto lg:max-w-none">
            {slots.map((slot, i) => {
              const card = lineup[i];
              return (
                <div
                  key={`${c.tactics.formation}-${i}`}
                  className="absolute -translate-x-1/2 translate-y-1/2"
                  style={{ left: `${slot.y}%`, bottom: `${slot.x}%` }}
                >
                  {card ? (
                    <PlayerChip card={card} pos={slot.pos} selected={selIdx === i} onClick={() => clickLineup(i)} />
                  ) : (
                    <EmptySlot pos={slot.pos} onClick={() => setSelIdx(i)} />
                  )}
                </div>
              );
            })}
          </Pitch>

          {/* Bench row */}
          <div className="glass p-3 mt-4">
            <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Banco</div>
            <div className="flex gap-4 flex-wrap">
              {bench.map((card) => (
                <PlayerChip
                  key={card.player.id}
                  card={card}
                  size="sm"
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
            <div className="grid grid-cols-3 gap-2">
              {FORMATION_IDS.map((f) => (
                <button
                  key={f}
                  onClick={() => { c.setFormation(f as FormationId); setSelIdx(null); }}
                  className={`py-2 rounded-xl font-display transition-all ${
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
                  onClick={() => c.setTactics({ mentality: m })}
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
                  onClick={() => c.setTactics({ style: s })}
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
    </main>
  );
}
