"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SfxRoot from "@/components/game/SfxRoot";
import { useCareer } from "@/lib/game/store";
import { EDITIONS, editionLabel } from "@/lib/data/editions";
import { IconLock, IconStadium } from "@/components/icons";

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
    career.newCareer(name.trim() || "Mister", editionId, "4-2-3-1");
    router.push("/squad");
  }

  return (
    <main className="arc-bg flex-1 flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <SfxRoot />

      {/* language selector */}
      <div className="absolute top-4 right-4 z-20">
        <button
          data-sfx="click"
          onClick={() => setLangOpen((o) => !o)}
          className="arc-btn arc-btn--paper px-3 py-1.5 text-xs flex items-center gap-2"
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
              className="arc-panel mt-2 p-2 w-52 absolute right-0 space-y-1"
            >
              {LANGS.map((l) => (
                <button
                  key={l.label}
                  disabled={!l.active}
                  data-sfx={l.active ? "click" : undefined}
                  onClick={() => setLangOpen(false)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg font-arc text-xs font-extrabold text-[var(--ink)] ${
                    l.active ? "hover:bg-[rgba(20,21,18,0.07)]" : "opacity-45 cursor-not-allowed"
                  }`}
                >
                  <span className="flex items-center gap-2">{l.flag} {l.label}</span>
                  {!l.active && <span className="text-[8px] uppercase tracking-wider border-2 border-[var(--ink)] rounded-full px-1.5 py-px">em obras</span>}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="text-center w-full max-w-3xl relative z-10"
      >
        <span className="arc-tag mb-5">★ Edição Fliperama ★</span>

        {/* giant title */}
        <h1 className="arc-logo select-none text-[clamp(4.2rem,15vw,10.5rem)] mt-3 mb-1">
          <span className="text-[var(--amarelo)]">FUT</span>
          <span className="text-[var(--paper)]">BATTLE</span>
        </h1>
        <p className="font-arc text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.4em] text-white/85 mb-9">
          Convoque · Comande · Conquiste
        </p>

        <AnimatePresence mode="wait">
          {step === "menu" && (
            <motion.nav
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center gap-3.5 w-full max-w-md mx-auto"
            >
              <button
                data-sfx="confirm"
                onClick={() => setStep("coach")}
                className="arc-btn arc-btn--card w-full py-4"
              >
                <span className="block text-2xl leading-tight">Novo campeonato</span>
                <span className="block font-arc text-[11px] font-bold opacity-75 mt-0.5">monta tua seleção de lendas e vai pra cima</span>
              </button>
              {hasCareer && (
                <button
                  data-sfx="confirm"
                  onClick={() => router.push(continueHref)}
                  className="arc-btn arc-btn--lima arc-btn--card w-full py-4"
                >
                  <span className="block text-xl leading-tight">Continuar — {career.coachName}</span>
                  <span className="block font-arc text-[11px] font-bold opacity-75 mt-0.5">a torcida não esqueceu de você</span>
                </button>
              )}
              <button
                disabled
                className="arc-btn arc-btn--paper arc-btn--card w-full py-4 relative"
              >
                <span className="text-xl leading-tight inline-flex items-center gap-2"><IconLock size={17} /> Online</span>
                <span className="block font-arc text-[11px] font-bold opacity-60 mt-0.5">em obras — o zelador tá ajeitando o servidor</span>
              </button>
              <p className="press-pulse font-arc text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/80 mt-4">
                toque para começar
              </p>
            </motion.nav>
          )}

          {step === "coach" && (
            <motion.div
              key="coach"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="arc-panel p-6 sm:p-7 max-w-md mx-auto text-left"
            >
              <span className="arc-tag">★ Passo 1 de 2</span>
              <h2 className="font-display text-3xl mt-3 mb-1 text-[var(--ink)]">QUEM É O TÉCNICO?</h2>
              <p className="font-arc text-sm font-semibold opacity-65 mb-4 text-[var(--ink)]">
                Sua seleção leva o seu nome na prancheta.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep("edition")}
                placeholder="Ex.: Felipão"
                maxLength={20}
                className="w-full bg-white border-[3px] border-[var(--ink)] rounded-2xl px-4 py-3 font-arc text-lg font-extrabold text-[var(--ink)] outline-none focus:shadow-[3px_4px_0_var(--ink)] transition-shadow mb-4"
              />
              {hasCareer && (
                <p className="font-arc text-xs font-extrabold text-[#C0182B] mb-3">
                  Atenção: começar de novo apaga a campanha atual de {career.coachName}.
                </p>
              )}
              <div className="flex gap-3">
                <button data-sfx="back" onClick={() => setStep("menu")} className="arc-btn arc-btn--paper flex-1 py-2.5 text-sm">Voltar</button>
                <button
                  data-sfx="confirm"
                  onClick={() => setStep("edition")}
                  disabled={!name.trim()}
                  className="arc-btn arc-btn--lima flex-1 py-2.5 text-sm"
                >
                  Escolher a copa
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
              className="arc-panel p-5 sm:p-6 max-w-2xl mx-auto text-left"
            >
              <span className="arc-tag">★ Passo 2 de 2</span>
              <h2 className="font-display text-3xl mt-3 mb-1 text-[var(--ink)]">EM QUAL COPA DO MUNDO?</h2>
              <p className="font-arc text-sm font-semibold opacity-65 mb-4 text-[var(--ink)]">
                País-sede e época definem estádios reais e clima. O torneio segue o formato
                2026: 48 seleções, grupos de A a L.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[44vh] overflow-y-auto pr-1">
                {EDITIONS.map((e) => (
                  <button
                    key={e.id}
                    data-sfx="confirm"
                    onClick={() => pickEdition(e.id)}
                    className="rounded-2xl border-[3px] border-[var(--ink)] bg-white p-3 text-left shadow-[3px_4px_0_var(--ink)] hover:-translate-y-0.5 hover:shadow-[4px_5px_0_var(--ink)] active:translate-y-1 active:shadow-[1px_2px_0_var(--ink)] transition-all"
                  >
                    <div className="text-2xl mb-1">{e.flag}</div>
                    <div className="font-display text-base leading-tight text-[var(--ink)]">
                      {editionLabel(e)}
                    </div>
                    <div className="font-arc text-[10px] font-bold opacity-55 text-[var(--ink)] flex items-center gap-1 mt-1">
                      <IconStadium size={12} /> {e.stadiums.length} estádios
                    </div>
                  </button>
                ))}
              </div>
              <button data-sfx="back" onClick={() => setStep("coach")} className="arc-btn arc-btn--paper w-full py-2.5 mt-4 text-sm">
                Voltar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}
