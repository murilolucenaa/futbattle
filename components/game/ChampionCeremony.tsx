"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { sound, vibrate } from "@/src/audio/SoundManager";
import { POSITION_SHORT, type Position } from "@/lib/game/types";
import ChampionCard, { type ChampionData } from "./ChampionCard";

type Stage = "title" | "roll" | "trophy" | "final";

const ROLL_MS = 280;

function sectorColor(pos: Position): string {
  if (pos === "GK") return "var(--gold)";
  if (pos === "RB" || pos === "CB" || pos === "LB") return "var(--ciano)";
  if (pos === "DM" || pos === "CM" || pos === "AM") return "var(--lima)";
  return "var(--laranja)";
}

function TrophyGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 4h12v3a6 6 0 0 1-12 0V4Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth={1.4} />
      <path d="M6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3M12 13v4" stroke="var(--ink)" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M12 13c-1.4 0-2.5 1.4-2.7 4h5.4c-.2-2.6-1.3-4-2.7-4Z" fill="var(--gold)" stroke="var(--ink)" strokeWidth={1.3} />
      <rect x="8" y="20" width="8" height="2" rx="1" fill="var(--gold)" stroke="var(--ink)" strokeWidth={1.3} />
    </svg>
  );
}

const CONFETTI = ["#FFC53D", "#00FF87", "#4DA3FF", "#FF4D5E", "#EAF2EC"];

export default function ChampionCeremony({
  data, onDismiss, onNewCampaign,
}: {
  data: ChampionData;
  onDismiss: () => void;
  onNewCampaign: () => void;
}) {
  const reduce = typeof window !== "undefined"
    && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const [stage, setStage] = useState<Stage>(reduce ? "final" : "title");
  const [rollIdx, setRollIdx] = useState(reduce ? data.xi.length : 0);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };
  const clearAll = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // ── timeline ───────────────────────────────────────────────
  useEffect(() => {
    if (reduce) return;
    sound.play("transition.whoosh");
    after(260, () => { sound.play("goal.horn"); sound.ambience("crowd.loop"); vibrate(40); });
    after(1900, () => setStage("roll"));
    return clearAll;
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // roll the XI one by one
  useEffect(() => {
    if (stage !== "roll") return;
    if (rollIdx >= data.xi.length) {
      after(560, () => { setStage("trophy"); });
      return;
    }
    sound.play("card.reveal");
    const t = setTimeout(() => setRollIdx((i) => i + 1), ROLL_MS);
    timers.current.push(t);
    return () => clearTimeout(t);
  }, [stage, rollIdx, data.xi.length]);

  useEffect(() => {
    if (stage !== "trophy") return;
    sound.play("match.trophy");
    vibrate(60);
    after(2800, () => setStage("final"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  function skip() {
    clearAll();
    setRollIdx(data.xi.length);
    setStage("final");
  }

  async function generateShare() {
    const node = cardRef.current;
    if (!node || sharing) return;
    setSharing(true);
    sound.play("ui.stamp");
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, { pixelRatio: 2, width: 1080, height: 1920, cacheBust: true, backgroundColor: "#0C3420" });
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
      const file = new File([blob], "futbattle-campeao.png", { type: "image/png" });
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: `${data.teamName} — Campeão Mundial` });
        return;
      }
    } catch { /* cancelled — fall through to download */ }
    const a = document.createElement("a");
    a.href = shareUrl;
    a.download = "futbattle-campeao.png";
    a.click();
  }

  return (
    <div className="fixed inset-0 z-[100] overflow-hidden bg-[#06160d]" onClick={stage !== "final" ? skip : undefined}>
      {/* stadium glow backdrop */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(1000px 700px at 50% 0%, rgba(255,200,27,0.22), transparent 62%)" }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08]" style={{ backgroundImage: "radial-gradient(#fff 1.5px, transparent 1.5px)", backgroundSize: "22px 22px" }} />

      {/* skip hint */}
      {stage !== "final" && (
        <button data-sound="back" className="absolute top-4 right-4 z-20 font-arc text-[11px] font-bold uppercase tracking-[0.2em] text-white/55 hover:text-white">
          pular ›
        </button>
      )}

      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {/* ── TITLE ─────────────────────────────────────── */}
          {stage === "title" && (
            <motion.div
              key="title"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center"
            >
              <motion.div
                initial={{ clipPath: "inset(0 100% 0 0)", skewX: -8 }}
                animate={{ clipPath: "inset(0 0% 0 0)", skewX: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="font-display text-[16vw] leading-[0.85] text-[var(--gold)] sm:text-8xl"
                style={{ textShadow: "4px 5px 0 #000" }}
              >
                CAMPEÃO<br />MUNDIAL
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-4 font-arc text-lg font-extrabold uppercase tracking-[0.3em] text-white"
              >
                {data.hostFlag} {data.host} {data.year}
              </motion.div>
            </motion.div>
          )}

          {/* ── ROLL (NFL retro reveal) ───────────────────── */}
          {stage === "roll" && (
            <motion.div
              key="roll"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex w-full max-w-md flex-col items-stretch gap-2"
            >
              <div className="mb-1 text-center font-arc text-xs font-extrabold uppercase tracking-[0.3em] text-[var(--gold)]">
                Os heróis da campanha
              </div>
              {data.xi.slice(0, rollIdx).map((h, i) => (
                <motion.div
                  key={h.name + i}
                  initial={{ opacity: 0, x: 60, skewX: -10 }}
                  animate={{ opacity: 1, x: 0, skewX: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex items-center gap-3 rounded-xl border-[3px] border-black px-3 py-2 ${
                    h.badge ? "bg-[var(--gold)] text-black" : "bg-[#101713] text-white"
                  }`}
                  style={{ boxShadow: "4px 4px 0 #000" }}
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-black font-display text-lg text-black"
                    style={{ background: sectorColor(h.pos) }}
                  >
                    {h.ovr}
                  </span>
                  {h.flag && <span className="shrink-0 text-xl leading-none">{h.flag}</span>}
                  <span className="min-w-0 flex-1 truncate font-display text-2xl uppercase leading-none">{h.name}</span>
                  {h.badge ? (
                    <span className="shrink-0 rounded-md bg-black px-2 py-1 font-arc text-[9px] font-black uppercase tracking-widest text-[var(--gold)]">
                      {h.badge === "artilheiro" ? "Artilheiro" : "Craque"}
                    </span>
                  ) : (
                    <span className="shrink-0 font-arc text-[11px] font-bold uppercase tracking-widest opacity-50">{POSITION_SHORT[h.pos]}</span>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── TROPHY ────────────────────────────────────── */}
          {stage === "trophy" && (
            <motion.div
              key="trophy"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="relative text-center"
            >
              {Array.from({ length: 44 }).map((_, i) => (
                <span
                  key={i}
                  className="confetti pointer-events-none absolute h-3 w-2 rounded-sm"
                  style={{
                    left: `${(i * 97) % 100}%`, top: "-10%",
                    background: CONFETTI[i % CONFETTI.length],
                    animationDuration: `${2.2 + (i % 5) * 0.6}s`,
                    animationDelay: `${(i % 9) * 0.18}s`,
                    animationIterationCount: "infinite",
                  }}
                  aria-hidden
                />
              ))}
              <motion.div
                initial={{ y: 80, scale: 0.5, opacity: 0 }}
                animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 120, damping: 12 }}
                className="mx-auto"
                style={{ filter: "drop-shadow(0 10px 0 rgba(0,0,0,0.4))" }}
              >
                <TrophyGlyph size={180} />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                className="mt-4 font-display text-5xl uppercase text-white sm:text-6xl"
                style={{ textShadow: "4px 5px 0 #000" }}
              >
                {data.teamName}
              </motion.div>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
                className="mt-2 font-arc text-base font-extrabold uppercase tracking-[0.25em] text-[var(--gold)]"
              >
                Téc. {data.coachName} · lenda eterna
              </motion.div>
            </motion.div>
          )}

          {/* ── FINAL (summary + share) ───────────────────── */}
          {stage === "final" && (
            <motion.div
              key="final"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-2 w-fit"><TrophyGlyph size={84} /></div>
              <h2 className="font-display text-4xl uppercase text-[var(--gold)]" style={{ textShadow: "3px 4px 0 #000" }}>Campeão do Mundo</h2>
              <p className="mt-1 font-display text-2xl text-white">{data.teamName}</p>
              <p className="mt-0.5 font-arc text-xs font-bold uppercase tracking-widest text-white/70">
                Téc. {data.coachName} · {data.host} {data.year}
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {([
                  ["Gols", String(data.totalGoals), "var(--gold)"],
                  ["Artilheiro", data.topScorer ? `${data.topScorer.goals}g` : "—", "var(--laranja)"],
                  ["Craque", data.topRated ? data.topRated.rating.toFixed(1) : "—", "var(--lima)"],
                ] as const).map(([label, val, col]) => (
                  <div key={label} className="rounded-xl border-[3px] border-black bg-[#101713] py-3" style={{ boxShadow: "3px 3px 0 #000" }}>
                    <div className="font-display text-3xl leading-none" style={{ color: col }}>{val}</div>
                    <div className="mt-1 font-arc text-[10px] font-black uppercase tracking-widest text-white/60">{label}</div>
                  </div>
                ))}
              </div>
              {(data.topScorer || data.topRated) && (
                <p className="mt-2 font-arc text-[11px] font-bold uppercase tracking-wide text-white/55">
                  {data.topScorer && <>artilheiro {data.topScorer.name}</>}
                  {data.topScorer && data.topRated && " · "}
                  {data.topRated && <>craque {data.topRated.name}</>}
                </p>
              )}

              {shareUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shareUrl} alt="Card de campeão" className="mx-auto mt-4 w-44 rounded-lg border-[3px] border-black" style={{ boxShadow: "4px 4px 0 #000" }} />
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                {!shareUrl ? (
                  <button data-sound="stamp" onClick={generateShare} disabled={sharing} className="arc-btn arc-btn--card px-6 py-3 text-base disabled:opacity-60">
                    <span className="block text-lg leading-tight">{sharing ? "Gerando…" : "Compartilhar nos stories"}</span>
                    <span className="block font-arc text-[10px] font-bold opacity-80">card 1080×1920 da campanha</span>
                  </button>
                ) : (
                  <button data-sound="confirm" onClick={nativeShare} className="arc-btn arc-btn--card px-6 py-3 text-base">
                    <span className="block text-lg leading-tight">Salvar / compartilhar</span>
                  </button>
                )}
                <div className="flex gap-2.5">
                  <button data-sound="back" onClick={onDismiss} className="arc-btn arc-btn--paper flex-1 px-4 py-2.5 text-sm">Ver torneio</button>
                  <button data-sound="confirm" onClick={onNewCampaign} className="arc-btn arc-btn--lima flex-1 px-4 py-2.5 text-sm">Nova campanha</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* off-screen story card for rasterizing */}
      <div style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }} aria-hidden>
        <ChampionCard ref={cardRef} data={data} />
      </div>
    </div>
  );
}
