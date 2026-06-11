"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCareer } from "@/lib/game/store";

export default function Home() {
  const router = useRouter();
  const career = useCareer();
  const [mounted, setMounted] = useState(false);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => setMounted(true), []);

  const hasCareer = mounted && career.teamName !== "";
  const continueHref = !career.draftDone ? "/squad" : career.cup ? "/cup" : "/squad";

  function start() {
    const n = name.trim() || "Minha Seleção";
    career.newCareer(n, "4-2-3-1");
    router.push("/squad");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      {/* floating decorations */}
      <div className="absolute top-[12%] left-[8%] text-5xl opacity-20 animate-float-slow select-none" aria-hidden>⚽</div>
      <div className="absolute bottom-[18%] right-[10%] text-6xl opacity-15 animate-float-slow select-none" style={{ animationDelay: "1.2s" }} aria-hidden>🏆</div>
      <div className="absolute top-[20%] right-[18%] text-3xl opacity-10 animate-float-slow select-none" style={{ animationDelay: "2.4s" }} aria-hidden>🥇</div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center max-w-2xl"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-sm font-bold tracking-[0.35em] text-[var(--muted)] uppercase mb-4"
        >
          Convoque · Comande · Conquiste
        </motion.p>

        <h1 className="font-display text-7xl sm:text-8xl leading-none mb-6">
          <span className="text-[var(--accent)] text-glow">FUT</span>BATTLE
        </h1>

        <p className="text-lg text-[var(--muted)] mb-10 leading-relaxed">
          Sorteie lendas de seleções históricas — de 1950 a 2022 — monte o
          esquadrão dos seus sonhos e dispute uma Copa do Mundo completa:
          fase de grupos, mata-mata e a glória eterna.
        </p>

        <AnimatePresence mode="wait">
          {!naming ? (
            <motion.div
              key="ctas"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <button onClick={() => setNaming(true)} className="btn-hero px-10 py-4 text-lg">
                🚀 Nova Jornada
              </button>
              {hasCareer && (
                <button onClick={() => router.push(continueHref)} className="btn-ghost px-10 py-4 text-lg font-semibold">
                  ▶ Continuar — {career.teamName}
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="naming"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-strong p-6 max-w-md mx-auto"
            >
              <label className="block text-left text-sm font-semibold text-[var(--muted)] mb-2">
                Nome da sua seleção
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder="Ex.: Galácticos FC"
                maxLength={24}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg outline-none focus:border-[var(--accent)] transition-colors mb-4"
              />
              {hasCareer && (
                <p className="text-xs text-[var(--red)] mb-3 text-left">
                  ⚠️ Isso apaga a jornada atual de “{career.teamName}”.
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setNaming(false)} className="btn-ghost flex-1 py-3 font-semibold">
                  Voltar
                </button>
                <button onClick={start} className="btn-hero flex-1 py-3">
                  Convocar →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* how it works */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 max-w-3xl w-full"
      >
        {[
          { icon: "🎲", title: "Convoque", desc: "A roleta sorteia uma seleção histórica por posição. Escolha a lenda ou gire de novo." },
          { icon: "📋", title: "Comande", desc: "Formação, mentalidade e estilo de jogo — mude tudo a cada partida, como um técnico de verdade." },
          { icon: "🏆", title: "Conquiste", desc: "Grupos, oitavas, quartas, semi e final. Ao vivo, em campo 2D, com narração e estatísticas." },
        ].map((c) => (
          <div key={c.title} className="glass p-5 text-left">
            <div className="text-3xl mb-3">{c.icon}</div>
            <h3 className="font-display text-lg mb-1 text-[var(--accent)]">{c.title}</h3>
            <p className="text-sm text-[var(--muted)] leading-relaxed">{c.desc}</p>
          </div>
        ))}
      </motion.div>
    </main>
  );
}
