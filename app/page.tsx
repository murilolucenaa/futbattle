"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useCareer } from "@/lib/game/store";
import { EDITIONS, editionLabel } from "@/lib/data/editions";
import { sfxConfirm, sfxMove } from "@/lib/sfx";
import { IconArrow, IconBall, IconClipboard, IconDice, IconLock, IconStadium, IconTrophy } from "@/components/icons";

type Step = "menu" | "coach" | "edition";

const LANGS = [
  { flag: "🇧🇷", label: "Português", active: true },
  { flag: "🇪🇸", label: "Español", active: false },
  { flag: "🇺🇸", label: "English", active: false },
];

export default function Home() {
  const router = useRouter();
  const career = useCareer();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [name, setName] = useState("");
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const hasCareer = mounted && career.coachName !== "";
  const continueHref = !career.draftDone ? "/squad" : career.cup ? "/cup" : "/squad";

  function pickEdition(editionId: string) {
    sfxConfirm();
    career.newCareer(name.trim() || "Mister", editionId, "4-2-3-1");
    router.push("/squad");
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      {/* ambient light beams */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[480px] rounded-full opacity-25"
          style={{ background: "radial-gradient(closest-side, rgba(0,255,135,0.18), transparent)" }} />
        <div className="absolute bottom-0 left-[8%] w-[420px] h-[280px] rounded-full opacity-15"
          style={{ background: "radial-gradient(closest-side, rgba(77,163,255,0.25), transparent)" }} />
        <div className="absolute bottom-[10%] right-[6%] w-[380px] h-[260px] rounded-full opacity-15"
          style={{ background: "radial-gradient(closest-side, rgba(255,197,61,0.2), transparent)" }} />
      </div>

      {/* language selector */}
      <div className="absolute top-5 right-5 z-20">
        <button
          onClick={() => { sfxMove(); setLangOpen((o) => !o); }}
          className="btn-ghost px-3 py-2 text-sm font-bold flex items-center gap-2"
          aria-label="Idioma"
        >
          🇧🇷 <span className="hidden sm:inline">PT-BR</span>
        </button>
        <AnimatePresence>
          {langOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="glass-strong mt-2 p-2 w-48 absolute right-0 space-y-1"
            >
              {LANGS.map((l) => (
                <button
                  key={l.label}
                  disabled={!l.active}
                  onClick={() => setLangOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${
                    l.active ? "hover:bg-[var(--surface-2)]" : "opacity-45 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center gap-2">{l.flag} {l.label}</span>
                  {!l.active && <span className="text-[9px] uppercase tracking-wider text-[var(--gold)]">em manutenção</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="text-center w-full max-w-3xl relative z-10"
      >
        <motion.p
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, letterSpacing: "0.35em" }}
          transition={{ delay: 0.25, duration: 0.8 }}
          className="text-xs sm:text-sm font-bold tracking-[0.35em] text-[var(--muted)] uppercase mb-3"
        >
          Convoque · Comande · Conquiste
        </motion.p>

        {/* giant logo */}
        <h1 className="font-display leading-none mb-2 select-none text-[clamp(4.5rem,16vw,11rem)]">
          <span className="text-[var(--accent)] text-glow">FUT</span>
          <span className="logo-sweep">BATTLE</span>
        </h1>
        <div className="h-[3px] w-44 mx-auto mb-10 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, #00FF87, transparent)" }} />

        <AnimatePresence mode="wait">
          {step === "menu" && (
            <motion.nav
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3 w-full max-w-sm mx-auto"
            >
              <button
                onClick={() => { sfxConfirm(); setStep("coach"); }}
                onMouseEnter={sfxMove}
                className="btn-hero w-full py-4 text-lg flex items-center justify-center gap-3"
              >
                <IconTrophy size={22} /> Novo Campeonato
              </button>
              {hasCareer && (
                <button
                  onClick={() => { sfxConfirm(); router.push(continueHref); }}
                  onMouseEnter={sfxMove}
                  className="btn-ghost w-full py-4 text-base font-bold flex items-center justify-center gap-3"
                >
                  <IconArrow size={20} /> Continuar — {career.coachName}
                </button>
              )}
              <button
                disabled
                className="btn-ghost w-full py-4 text-base font-bold flex items-center justify-center gap-3 opacity-50 cursor-not-allowed relative"
              >
                <IconLock size={18} /> Online
                <span className="absolute right-4 text-[9px] uppercase tracking-widest text-[var(--gold)] border border-[rgba(255,197,61,0.4)] rounded-full px-2 py-0.5">
                  em manutenção
                </span>
              </button>
            </motion.nav>
          )}

          {step === "coach" && (
            <motion.div
              key="coach"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-strong p-7 max-w-md mx-auto text-left"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Passo 1 de 2</div>
              <h2 className="font-display text-2xl mb-1">Quem é o técnico?</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                Sua seleção levará o seu nome na prancheta.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && (sfxConfirm(), setStep("edition"))}
                placeholder="Ex.: Felipão"
                maxLength={20}
                className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-lg outline-none focus:border-[var(--accent)] transition-colors mb-4"
              />
              {hasCareer && (
                <p className="text-xs text-[var(--red)] mb-3">
                  Atenção: começar de novo apaga a campanha atual de {career.coachName}.
                </p>
              )}
              <div className="flex gap-3">
                <button onClick={() => setStep("menu")} className="btn-ghost flex-1 py-3 font-semibold">Voltar</button>
                <button
                  onClick={() => { sfxConfirm(); setStep("edition"); }}
                  disabled={!name.trim()}
                  className="btn-hero flex-1 py-3 flex items-center justify-center gap-2"
                >
                  Escolher a Copa <IconArrow size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {step === "edition" && (
            <motion.div
              key="edition"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="glass-strong p-6 max-w-2xl mx-auto text-left"
            >
              <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-[var(--accent)] mb-1">Passo 2 de 2</div>
              <h2 className="font-display text-2xl mb-1">Em qual Copa do Mundo?</h2>
              <p className="text-sm text-[var(--muted)] mb-4">
                País-sede e época definem os estádios reais e o clima da sua campanha.
                O torneio segue o formato 2026: 48 seleções, grupos de A a L.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[46vh] overflow-y-auto pr-1">
                {EDITIONS.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => pickEdition(e.id)}
                    onMouseEnter={sfxMove}
                    className="glass p-3 text-left hover:bg-[var(--surface-2)] hover:border-[rgba(0,255,135,0.4)] transition-all group"
                  >
                    <div className="text-2xl mb-1">{e.flag}</div>
                    <div className="font-display text-base leading-tight group-hover:text-[var(--accent)] transition-colors">
                      {editionLabel(e)}
                    </div>
                    <div className="text-[10px] text-[var(--muted)] flex items-center gap-1 mt-1">
                      <IconStadium size={12} /> {e.stadiums.length} estádios
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setStep("coach")} className="btn-ghost w-full py-2.5 mt-4 font-semibold">
                Voltar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* how it works */}
      {step === "menu" && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-14 max-w-3xl w-full relative z-10"
        >
          {[
            { icon: <IconDice size={26} />, title: "Convoque", desc: "A roleta sorteia uma seleção histórica. Escolha qualquer lenda do elenco — os giros são poucos, o sorteio é honesto." },
            { icon: <IconClipboard size={26} />, title: "Comande", desc: "Arraste jogadores, mude formação, mentalidade e estilo — na prancheta e no calor do jogo." },
            { icon: <IconBall size={26} />, title: "Conquiste", desc: "48 seleções, grupos de A a L, mata-mata até a final — ao vivo, com narração, estádios e estatísticas." },
          ].map((c) => (
            <div key={c.title} className="glass p-5 text-left">
              <div className="text-[var(--accent)] mb-3">{c.icon}</div>
              <h3 className="font-display text-lg mb-1 text-[var(--accent)]">{c.title}</h3>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </motion.div>
      )}
    </main>
  );
}
