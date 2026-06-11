"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { sfxConfirm } from "@/lib/sfx";
import { IconMic } from "@/components/icons";

/**
 * Animated press-conference scene: the coach sits down in front of the
 * microphones before announcing the squad. Pure CSS/SVG, skippable.
 */
export default function PressConference({
  coachName, editionId, onDone,
}: {
  coachName: string;
  editionId: string;
  onDone: () => void;
}) {
  const [line, setLine] = useState(0);
  const ed = EDITION_BY_ID[editionId];
  const lines = [
    `${ed ? editionLabel(ed) : "Copa do Mundo"} — sala de imprensa lotada.`,
    `Entra ${coachName}, o novo técnico. Flashes por todo lado.`,
    `"Senhoras e senhores… amanhã anuncio a convocação."`,
  ];

  useEffect(() => {
    const id = setInterval(() => setLine((l) => Math.min(l + 1, lines.length)), 1700);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <div className="fixed inset-0 z-50 pressroom flex flex-col items-center justify-center overflow-hidden">
      {/* camera flashes */}
      {[12, 28, 67, 84, 45].map((left, i) => (
        <div
          key={i}
          className="camera-flash absolute w-20 h-20 rounded-full pointer-events-none"
          style={{
            left: `${left}%`, top: `${18 + (i % 3) * 9}%`,
            background: "radial-gradient(closest-side, rgba(255,255,255,0.9), transparent)",
            animationDelay: `${i * 0.65}s`,
          }}
          aria-hidden
        />
      ))}

      {/* backdrop with sponsor-style pattern */}
      <div
        className="absolute inset-x-0 top-0 h-[52%] opacity-30 pointer-events-none"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 34px, rgba(0,255,135,0.12) 34px 36px), repeating-linear-gradient(-45deg, transparent 0 34px, rgba(77,163,255,0.10) 34px 36px)",
        }}
        aria-hidden
      />

      {/* scene: desk + coach silhouette + mics */}
      <motion.svg
        viewBox="0 0 320 180"
        className="w-full max-w-xl px-6 relative z-10"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        aria-hidden
      >
        {/* coach (slides in and "sits") */}
        <motion.g
          initial={{ x: -90, y: -8 }}
          animate={{ x: 0, y: 0 }}
          transition={{ delay: 0.7, duration: 1.1, ease: "easeOut" }}
        >
          <circle cx="160" cy="62" r="17" fill="#1E2A40" stroke="#3A4A66" />
          <path d="M134 122c0-22 12-34 26-34s26 12 26 34" fill="#16233A" stroke="#3A4A66" />
          {/* suit collar */}
          <path d="M152 90l8 12 8-12" fill="none" stroke="#00FF87" strokeWidth="2" />
        </motion.g>
        {/* desk */}
        <rect x="70" y="118" width="180" height="34" rx="4" fill="#0D1830" stroke="#28344E" />
        <rect x="70" y="118" width="180" height="8" fill="#13203A" />
        {/* mics */}
        {[120, 145, 175, 200].map((x, i) => (
          <motion.g
            key={x}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 + i * 0.15 }}
          >
            <line x1={x} y1={118} x2={x + (i % 2 ? 6 : -6)} y2={97} stroke="#46587A" strokeWidth="2" />
            <ellipse cx={x + (i % 2 ? 6 : -6)} cy={94} rx="5" ry="7" fill={["#FF4D5E", "#4DA3FF", "#FFC53D", "#EAF2EC"][i]} />
          </motion.g>
        ))}
        {/* water glass */}
        <rect x="226" y="106" width="8" height="12" rx="1.5" fill="rgba(140,200,255,0.4)" />
      </motion.svg>

      {/* caption lines */}
      <div className="relative z-10 h-24 mt-6 text-center px-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={Math.min(line, lines.length - 1)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-lg sm:text-xl font-semibold max-w-lg"
          >
            {lines[Math.min(line, lines.length - 1)]}
          </motion.p>
        </AnimatePresence>
        <div className="flex items-center justify-center gap-1.5 mt-3 text-[var(--muted)]">
          <IconMic size={14} />
          <span className="text-[10px] uppercase tracking-[0.3em]">coletiva de imprensa</span>
        </div>
      </div>

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: line >= lines.length ? 0 : 2.2 }}
        onClick={() => { sfxConfirm(); onDone(); }}
        className="btn-hero px-10 py-4 text-lg mt-4 relative z-10"
      >
        Anunciar a convocação →
      </motion.button>
      <button
        onClick={onDone}
        className="text-xs text-[var(--muted)] hover:text-white mt-3 relative z-10"
      >
        pular introdução
      </button>
    </div>
  );
}
