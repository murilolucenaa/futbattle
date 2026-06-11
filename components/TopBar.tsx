"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCareer } from "@/lib/game/store";
import { sfxBack, sfxMove } from "@/lib/sfx";
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
    sfxBack();
    setToast(draftDone ? "Já está tudo pronto, mister? Faça o sorteio na tela da Seleção." : "Primeiro a convocação, mister. Depois o sorteio da Copa.");
    setTimeout(() => setToast(null), 2600);
  }

  const linkCls = (active: boolean, locked = false) =>
    `px-4 py-1.5 rounded-full text-sm font-semibold transition-colors flex items-center gap-1.5 ${
      active
        ? "bg-[var(--accent)] text-[#04130B]"
        : locked
          ? "text-[var(--muted)] opacity-60"
          : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
    }`;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(6,10,18,0.7)] border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-wide">
          <span className="text-[var(--accent)]">FUT</span>BATTLE
        </Link>
        <nav className="flex items-center gap-1">
          <Link href="/squad" onMouseEnter={sfxMove} className={linkCls(pathname.startsWith("/squad"))}>
            Seleção
          </Link>
          <button onClick={clickCopa} onMouseEnter={sfxMove} className={linkCls(pathname.startsWith("/cup"), !cupReady)}>
            {!cupReady && <IconLock size={13} />} Copa
          </button>
        </nav>
      </div>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute left-1/2 -translate-x-1/2 top-16 glass-strong px-5 py-3 text-sm font-semibold whitespace-nowrap"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
