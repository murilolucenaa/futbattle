"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { sound } from "@/src/audio/SoundManager";

/**
 * Animated TV-broadcast press conference: stadium-night press room, camera
 * flashes (rendered in a <canvas> for 60fps), a lower-third that slides in,
 * the coach's line typed out, then the announce CTA. Fully skippable (Esc or
 * the "pular" link) and honours prefers-reduced-motion (jumps to the final
 * frame, no flashes). Same props as before so the call site is untouched.
 */
export default function PressConference({
  coachName,
  editionId,
  onDone,
  phrase,
  conferenceName = "AO VIVO · COLETIVA DE IMPRENSA",
}: {
  coachName: string;
  editionId: string;
  onDone: () => void;
  /** Override the typed line (defaults to the classic announce quote). */
  phrase?: string;
  /** Lower-third label text. */
  conferenceName?: string;
}) {
  const ed = EDITION_BY_ID[editionId];
  const edLabel = ed ? editionLabel(ed) : "Copa do Mundo";
  const FULL = phrase ?? "Senhoras e senhores… amanhã anuncio a convocação.";

  const [reduced, setReduced] = useState(false);
  const [lowerIn, setLowerIn] = useState(false);
  const [startTyping, setStartTyping] = useState(false);
  const [typed, setTyped] = useState(0);
  const [phraseDone, setPhraseDone] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [exiting, setExiting] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const exitedRef = useRef(false);

  // ── exit: whoosh + fade to black, then hand off to the draft ──
  function exitTo() {
    if (exitedRef.current) return;
    exitedRef.current = true;
    setExiting(true);
    sound.play("transition.whoosh");
    sound.stopAmbience(400);
    window.setTimeout(onDone, 400);
  }
  // backdrop click fast-forwards the animation (so the line is readable + CTA up)
  function fastForward() {
    if (phraseDone) return;
    setLowerIn(true);
    setTyped(FULL.length);
    setPhraseDone(true);
    setShowCta(true);
  }

  // ── sequence + reduced-motion ─────────────────────────────────
  useEffect(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setReduced(!!prefersReduced);

    sound.ambience("crowd.murmur", { fade: 600, intensity: 0.7 });

    if (prefersReduced) {
      setLowerIn(true);
      setTyped(FULL.length);
      setPhraseDone(true);
      setShowCta(true);
      return () => sound.stopAmbience(300);
    }

    const t1 = window.setTimeout(() => {
      setLowerIn(true);
      sound.play("ui.tab");
    }, 800);
    const t2 = window.setTimeout(() => setStartTyping(true), 1300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      sound.stopAmbience(300);
    };
  }, [FULL]);

  // ── typewriter ────────────────────────────────────────────────
  useEffect(() => {
    if (!startTyping || reduced) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(i);
      if (i % 3 === 0) sound.play("ui.tick");
      if (i >= FULL.length) {
        clearInterval(id);
        setPhraseDone(true);
      }
    }, 40);
    return () => clearInterval(id);
  }, [startTyping, reduced, FULL]);

  // CTA appears a beat after the line finishes
  useEffect(() => {
    if (!phraseDone || reduced) return;
    const id = window.setTimeout(() => setShowCta(true), 450);
    return () => clearTimeout(id);
  }, [phraseDone, reduced]);

  // ── camera flashes (canvas, 60fps) ────────────────────────────
  useEffect(() => {
    if (reduced) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    type Flash = { x: number; y: number; born: number; life: number; r: number };
    const flashes: Flash[] = [];
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // ~2.5 flashes/second, born in the lower half (the seated press pit)
      if (!exitedRef.current && Math.random() < dt * 2.5) {
        flashes.push({
          x: Math.random(),
          y: 0.48 + Math.random() * 0.46,
          born: now,
          life: 240 + Math.random() * 140,
          r: (44 + Math.random() * 44) * dpr,
        });
        sound.play("camera.flash", { rate: 0.9 + Math.random() * 0.2 });
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const p = (now - f.born) / f.life;
        if (p >= 1) {
          flashes.splice(i, 1);
          continue;
        }
        const env = Math.sin(Math.PI * p); // 0 → 1 → 0 bloom
        const x = f.x * canvas.width;
        const y = f.y * canvas.height;
        const rad = f.r * (0.4 + 0.6 * env);
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, `rgba(255,255,255,${0.85 * env})`);
        g.addColorStop(0.4, `rgba(214,236,255,${0.32 * env})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  const cursorVisible = !phraseDone || true; // keep a blinking cursor at the end too

  return (
    <div
      onClick={fastForward}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: "radial-gradient(120% 90% at 50% 18%, #16233A 0%, #0B1422 55%, #060B14 100%)" }}
    >
      {/* breathing spotlight */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(48% 40% at 50% 30%, rgba(120,180,255,0.18), transparent 70%)" }}
        animate={reduced ? undefined : { opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        aria-hidden
      />

      {/* sponsor-board diagonal pattern behind the desk */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[55%] opacity-25"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 34px, rgba(120,200,160,0.12) 34px 36px), repeating-linear-gradient(-45deg, transparent 0 34px, rgba(90,150,255,0.10) 34px 36px)",
        }}
        aria-hidden
      />

      {/* camera flashes */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />

      {/* lower-third TV bar */}
      <AnimatePresence>
        {lowerIn && (
          <motion.div
            initial={{ x: "-110%" }}
            animate={{ x: 0 }}
            exit={{ x: "-110%" }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute left-0 top-[12%] z-20 flex items-center gap-2 border-y-[3px] border-r-[3px] border-[var(--ink)] bg-[var(--laranja)] py-2 pl-4 pr-6 shadow-[5px_6px_0_var(--ink)]"
          >
            <motion.span
              className="inline-block h-2.5 w-2.5 rounded-full bg-[#FFF6EE]"
              animate={reduced ? undefined : { opacity: [1, 0.2, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
            />
            <span className="font-arc text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#3A1405]">
              {conferenceName}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* scene: desk + coach silhouette + mics */}
      <motion.svg
        viewBox="0 0 320 180"
        className="relative z-10 w-full max-w-xl px-6"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        aria-hidden
      >
        {/* coach — slides in then idle-breathes */}
        <motion.g
          initial={reduced ? undefined : { x: -90, y: -8, opacity: 0 }}
          animate={{ x: 0, y: 0, opacity: 1 }}
          transition={{ delay: reduced ? 0 : 0.6, duration: 1.0, ease: "easeOut" }}
        >
          <motion.g
            style={{ transformOrigin: "160px 120px" }}
            animate={reduced ? undefined : { scaleY: [1, 1.012, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <circle cx="160" cy="62" r="17" fill="#1E2A40" stroke="#3A4A66" strokeWidth="1.5" />
            <path d="M134 122c0-22 12-34 26-34s26 12 26 34" fill="#16233A" stroke="#3A4A66" strokeWidth="1.5" />
            <path d="M152 90l8 12 8-12" fill="none" stroke="var(--lima)" strokeWidth="2" />
          </motion.g>
        </motion.g>

        {/* desk */}
        <rect x="70" y="118" width="180" height="34" rx="4" fill="#0D1830" stroke="#28344E" />
        <rect x="70" y="118" width="180" height="8" fill="#13203A" />

        {/* mics — staggered reveal, gentle sway */}
        {[120, 145, 175, 200].map((x, i) => {
          const tip = x + (i % 2 ? 6 : -6);
          return (
            <motion.g
              key={x}
              initial={reduced ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduced ? 0 : 1.0 + i * 0.12 }}
              style={{ transformOrigin: `${x}px 118px` }}
            >
              <motion.g
                style={{ transformOrigin: `${x}px 118px` }}
                animate={reduced ? undefined : { rotate: [-1.2, 1.2, -1.2] }}
                transition={{ duration: 2.4 + i * 0.3, repeat: Infinity, ease: "easeInOut" }}
              >
                <line x1={x} y1={118} x2={tip} y2={97} stroke="#46587A" strokeWidth="2" />
                <ellipse cx={tip} cy={94} rx="5" ry="7" fill={["#FF4D5E", "#4DA3FF", "#FFC53D", "#EAF2EC"][i]} />
              </motion.g>
            </motion.g>
          );
        })}

        {/* water glass */}
        <rect x="226" y="106" width="8" height="12" rx="1.5" fill="rgba(140,200,255,0.4)" />
      </motion.svg>

      {/* edition + coach tag */}
      <div className="relative z-10 mt-4 text-center">
        <p className="font-arc text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/55">
          {edLabel}
        </p>
        <p className="font-arc text-sm font-bold uppercase tracking-wide text-white/85">
          {coachName} · Técnico
        </p>
      </div>

      {/* typed line */}
      <div className="relative z-10 mt-5 min-h-[64px] max-w-lg px-6 text-center">
        <p className="font-arc text-lg font-semibold leading-snug text-white sm:text-xl">
          {typed > 0 && <span>“</span>}
          {FULL.slice(0, typed)}
          <motion.span
            className="ml-0.5 inline-block w-[2px] translate-y-[2px] bg-[var(--amarelo)]"
            style={{ height: "1.05em" }}
            animate={{ opacity: cursorVisible ? [1, 0, 1] : 0 }}
            transition={{ duration: 0.9, repeat: Infinity }}
            aria-hidden
          />
          {phraseDone && <span>”</span>}
        </p>
      </div>

      {/* CTA */}
      <div className="relative z-10 mt-6 flex min-h-[80px] flex-col items-center">
        <AnimatePresence>
          {showCta && (
            <motion.button
              initial={reduced ? undefined : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              data-sound="confirm"
              onClick={(e) => {
                e.stopPropagation();
                exitTo();
              }}
              className="arc-btn arc-btn--laranja px-9 py-4 text-lg"
            >
              <motion.span
                className="inline-block"
                animate={reduced ? undefined : { scale: [1, 1.04, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                Anunciar a convocação →
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>

        <button
          data-sound="cancel"
          onClick={(e) => {
            e.stopPropagation();
            exitTo();
          }}
          className="mt-3 font-arc text-xs uppercase tracking-widest text-white/45 transition-colors hover:text-white/80"
        >
          pular introdução
        </button>
      </div>

      {/* fade to black on exit */}
      <AnimatePresence>
        {exiting && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-30 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
