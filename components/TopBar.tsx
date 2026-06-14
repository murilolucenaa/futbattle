"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCareer } from "@/lib/game/store";
import { sound } from "@/src/audio/SoundManager";
import SoundToggle from "@/components/game/SoundToggle";
import { IconLock } from "@/components/icons";

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const cupReady = mounted && c.cup !== null;
  const draftDone = mounted && c.draftDone;

  function clickCopa() {
    if (cupReady) { router.push("/cup"); return; }
    sound.play("ui.error");
    setToast(draftDone ? "Já está tudo pronto, mister? Faça o sorteio na tela da Seleção." : "Primeiro a convocação, mister. Depois o sorteio da Copa.");
    setTimeout(() => setToast(null), 2600);
  }

  const navCls = (active: boolean, locked = false) =>
    `arc-btn tap-sm px-3 sm:px-4 py-1 text-xs flex items-center justify-center gap-1.5 ${
      active ? "" : locked ? "arc-btn--paper opacity-60" : "arc-btn--paper"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-[var(--ink)] border-b-[3px] border-black/60 safe-t safe-x">
      <div className="mx-auto max-w-6xl px-3 sm:px-4 h-14 flex items-center justify-between gap-2">
        <Link href="/" data-sound="cancel" className="font-display text-xl sm:text-2xl tracking-wide text-[var(--paper)] shrink-0">
          <span className="text-[var(--amarelo)]">FUT</span>BATTLE
        </Link>
        <nav className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/squad" data-sound="confirm" className={navCls(pathname.startsWith("/squad"))}>
            Seleção
          </Link>
          <button onClick={clickCopa} data-sound={cupReady ? "confirm" : undefined} className={navCls(pathname.startsWith("/cup"), !cupReady)}>
            {!cupReady && <IconLock size={12} />} Copa
          </button>
          <SoundToggle className="ml-0.5 sm:ml-1" />
        </nav>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 top-16 w-[min(92vw,30rem)] arc-panel px-4 py-3 font-arc text-sm font-extrabold text-center text-[var(--ink)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
