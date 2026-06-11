"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SQUADS, squadLabel } from "@/lib/data/squads";
import { drawSquad } from "@/lib/game/rules";
import type { Card, PlayerDef, SquadDef } from "@/lib/game/types";
import { POSITION_SHORT } from "@/lib/game/types";
import { sfxConfirm, sfxReveal, sfxTick } from "@/lib/sfx";
import { IconDice, IconStar } from "@/components/icons";

interface Props {
  open: boolean;
  title: string;            // "Titular 7/11" · "Reserva 2/4"
  usedNames: Set<string>;
  rerollsLeft: number;
  onSpendReroll: () => void;
  onPick: (card: Card) => void;
  onClose: () => void;
}

function pickable(s: SquadDef, usedNames: Set<string>): PlayerDef[] {
  return s.players.filter((p) => !usedNames.has(p.name));
}

export default function RouletteModal({
  open, title, usedNames, rerollsLeft, onSpendReroll, onPick, onClose,
}: Props) {
  const [phase, setPhase] = useState<"rolling" | "landed">("rolling");
  const [display, setDisplay] = useState<SquadDef>(SQUADS[0]);
  const [landed, setLanded] = useState<SquadDef | null>(null);
  const [genOpen, setGenOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roll = useCallback(() => {
    const pool = SQUADS.filter((s) => pickable(s, usedNames).length > 0);
    const target = drawSquad(pool);
    if (!target) return;
    setPhase("rolling");
    setLanded(null);
    setGenOpen(false);

    let elapsed = 0;
    let delay = 50;
    const spin = () => {
      setDisplay(SQUADS[Math.floor(Math.random() * SQUADS.length)]);
      sfxTick();
      elapsed += delay;
      delay = Math.min(340, delay * 1.16); // decelerate — suspense
      if (elapsed < 2700) {
        timer.current = setTimeout(spin, delay);
      } else {
        setDisplay(target);
        setLanded(target);
        sfxReveal();
        timer.current = setTimeout(() => setPhase("landed"), 420);
      }
    };
    spin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedNames]);

  useEffect(() => {
    if (open) roll();
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const eligible = landed ? pickable(landed, usedNames) : [];
  const freeReroll = eligible.length === 0; // nothing usable → spin again free
  const canReroll = freeReroll || rerollsLeft > 0;
  const generations = landed
    ? SQUADS.filter((s) => s.nation === landed.nation && s.id !== landed.id && pickable(s, usedNames).length > 0)
    : [];

  function handleReroll() {
    if (!canReroll) return;
    if (!freeReroll) onSpendReroll();
    roll();
  }

  function switchGeneration(s: SquadDef) {
    if (rerollsLeft <= 0) return;
    onSpendReroll();
    sfxReveal();
    setLanded(s);
    setDisplay(s);
    setGenOpen(false);
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          className="glass-strong w-full max-w-xl p-6 max-h-[88vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-xl">
              Convocando: <span className="text-[var(--accent)]">{title}</span>
            </h2>
            <button onClick={onClose} className="text-[var(--muted)] hover:text-white text-xl px-2" aria-label="Fechar">✕</button>
          </div>
          <div className="text-xs text-[var(--muted)] mb-4 flex items-center gap-1.5">
            <IconDice size={13} />
            Giros restantes:{" "}
            <span className={`font-bold ${rerollsLeft <= 1 ? "text-[var(--red)]" : "text-[var(--accent)]"}`}>{rerollsLeft}</span>
          </div>

          {/* Roulette window */}
          <div className={`relative rounded-2xl border-2 overflow-hidden mb-4 transition-colors ${
            phase === "landed" ? "border-[var(--accent)]" : "border-[var(--border)]"
          }`}>
            <div className="relative bg-[var(--bg-2)] py-9 flex flex-col items-center justify-center overflow-hidden">
              {/* spotlight sweep while rolling */}
              {phase === "rolling" && (
                <div className="absolute inset-0 spotlight-pulse pointer-events-none"
                  style={{ background: "radial-gradient(420px 150px at 50% 50%, rgba(0,255,135,0.10), transparent)" }} />
              )}
              <div
                key={display.id + (phase === "landed" ? "-l" : `-r${Math.random()}`)}
                className={`text-center ${phase === "landed" ? "reveal-pop" : ""}`}
              >
                <div className="text-7xl mb-2 drop-shadow-[0_0_24px_rgba(0,255,135,0.25)]">{display.flag}</div>
                <div className="font-display text-3xl tracking-wide">{squadLabel(display)}</div>
              </div>
              {phase === "landed" && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-[11px] font-bold tracking-[0.3em] text-[var(--accent)] mt-3 uppercase flex items-center gap-2"
                >
                  <IconStar size={12} /> seleção sorteada <IconStar size={12} />
                </motion.div>
              )}
            </div>
            {phase === "rolling" && <div className="absolute inset-0 shimmer pointer-events-none" />}
          </div>

          {phase === "landed" && landed && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              {/* full roster — pick ANY player */}
              {eligible.length === 0 ? (
                <p className="text-center text-[var(--muted)] py-4 text-sm">
                  Todos os jogadores aproveitáveis dessa seleção já foram convocados. Gire de novo — esse é grátis.
                </p>
              ) : (
                <div className="space-y-1.5 mb-4 max-h-[34vh] overflow-y-auto pr-1">
                  {[...eligible].sort((a, b) => b.ovr - a.ovr).map((p, i) => (
                    <motion.button
                      key={p.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.5) }}
                      onClick={() => {
                        sfxConfirm();
                        onPick({
                          player: p, squadId: landed.id,
                          nation: landed.nation, year: landed.year, flag: landed.flag,
                        });
                      }}
                      className="w-full glass transition-colors p-2.5 flex items-center gap-3 text-left group hover:bg-[var(--surface-2)] hover:border-[rgba(0,255,135,0.35)]"
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-display text-lg shrink-0 ${
                        p.ovr >= 95 ? "bg-gradient-to-br from-[#FFC53D] to-[#FF8A00] text-black"
                        : p.ovr >= 90 ? "bg-gradient-to-br from-[#00FF87] to-[#00C868] text-black"
                        : p.ovr >= 85 ? "bg-[var(--surface-2)] text-[var(--accent)]"
                        : "bg-[var(--surface-2)] text-white"
                      }`}>
                        {p.ovr}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate text-sm">{p.name}</div>
                        <div className="flex gap-1 mt-0.5">
                          {p.positions.map((x) => (
                            <span key={x} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-black/40 text-[var(--accent)]">
                              {POSITION_SHORT[x]}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[var(--accent)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        Convocar →
                      </span>
                    </motion.button>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={handleReroll}
                  disabled={!canReroll}
                  className="btn-ghost flex-1 py-3 font-bold disabled:opacity-35 flex items-center justify-center gap-2"
                >
                  <IconDice size={16} />
                  {freeReroll
                    ? "Sortear de novo (grátis)"
                    : canReroll
                      ? `Sortear outra (−1 giro)`
                      : "Sem giros — escolha um jogador"}
                </button>
                {generations.length > 0 && (
                  <button
                    onClick={() => setGenOpen((o) => !o)}
                    disabled={rerollsLeft <= 0}
                    className="btn-ghost flex-1 py-3 font-bold disabled:opacity-35"
                  >
                    Mudar geração (−1 giro)
                  </button>
                )}
              </div>

              <AnimatePresence>
                {genOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2 pt-3">
                      {generations.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => switchGeneration(s)}
                          className="btn-ghost px-4 py-2 text-sm font-bold hover:border-[rgba(0,255,135,0.4)]"
                        >
                          {s.flag} {s.year}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
