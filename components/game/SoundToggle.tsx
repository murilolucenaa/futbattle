"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { sound, type Channel } from "@/src/audio/SoundManager";
import { IconSound, IconMute } from "@/components/icons";

const CHANNEL_LABEL: Record<Channel | "master", string> = {
  master: "Geral",
  ui: "Menu",
  music: "Música",
  ambience: "Torcida",
  match: "Partida",
};

/** Header control: mute master + popover with per-channel volume sliders. */
export default function SoundToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  // local mirror so sliders re-render; source of truth is the SoundManager
  const [vols, setVols] = useState<Record<string, number>>({});

  useEffect(() => {
    setMounted(true);
    setMuted(sound.isMuted());
    const v: Record<string, number> = { master: sound.getVolume("master") };
    for (const ch of sound.channels()) v[ch] = sound.getVolume(ch);
    setVols(v);
  }, []);

  if (!mounted) return null;

  const rows: (Channel | "master")[] = ["master", ...sound.channels()];

  return (
    <div className={`relative ${className}`}>
      <button
        data-sound
        onClick={() => {
          // primary tap toggles mute; long-press handled by the chevron below
          const m = sound.toggleMuted();
          setMuted(m);
          if (!m) sound.play("ui.confirm");
        }}
        onContextMenu={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        aria-label={muted ? "Ativar som" : "Silenciar"}
        className="arc-mini w-9 h-9 grid place-items-center text-[var(--ink)]"
        title="Som (clique: mudo · ▾ volumes)"
      >
        {muted ? <IconMute size={18} /> : <IconSound size={18} />}
      </button>
      <button
        data-sound="tab"
        onClick={() => setOpen((o) => !o)}
        aria-label="Volumes"
        className="absolute -bottom-1 -right-1 w-4 h-4 grid place-items-center rounded-full border-2 border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)] text-[8px] font-black leading-none"
      >
        ▾
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="arc-panel absolute right-0 mt-2 p-3 w-56 z-[300] space-y-2"
          >
            <div className="font-display text-base text-[var(--ink)] mb-1">ÁUDIO</div>
            {rows.map((ch) => (
              <label key={ch} className="block">
                <div className="flex justify-between font-arc text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink)] opacity-75">
                  <span>{CHANNEL_LABEL[ch]}</span>
                  <span>{Math.round((vols[ch] ?? 0) * 100)}</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={vols[ch] ?? 0}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    sound.setVolume(ch, v);
                    setVols((s) => ({ ...s, [ch]: v }));
                  }}
                  onPointerUp={() => sound.play("ui.move")}
                  className="w-full accent-[var(--ink)] cursor-pointer"
                />
              </label>
            ))}
            <button
              data-sound={muted ? "confirm" : "cancel"}
              onClick={() => { const m = sound.toggleMuted(); setMuted(m); }}
              className="arc-btn arc-btn--paper w-full py-1.5 text-xs mt-1"
            >
              {muted ? "Ativar som" : "Silenciar tudo"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
