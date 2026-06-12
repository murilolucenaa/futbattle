"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import SoundProvider from "@/src/audio/SoundProvider";
import { sound } from "@/src/audio/SoundManager";
import KitJersey, { PATTERNS, type KitPattern } from "@/components/game/KitJersey";
import { useCareer, USER_COLORS, USER_KIT2 } from "@/lib/game/store";
import { EDITIONS, EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { fielAvailable } from "@/lib/game/formats/registry";
import type { CupMode } from "@/lib/game/types";
import { IconLock, IconStadium } from "@/components/icons";

type Step = "menu" | "coach" | "kit" | "edition";
type Kit = [string, string];

const LANGS = [
  { flag: "🇧🇷", label: "Português", active: true },
  { flag: "🇪🇸", label: "Español", active: false },
  { flag: "🇺🇸", label: "English", active: false },
];

/** Curated flat arcade palette (no purple — house rule). */
const SWATCHES = [
  "#00FF87", "#0B8A3D", "#1FA84C", "#F4C20D", "#FFD93D", "#E84D2A",
  "#C0182B", "#E64A9B", "#0EA5C4", "#1565C0", "#0F2C66", "#1A2230",
  "#F4F7F5", "#9AA0A6", "#101418", "#7A4E1E",
];

/** Quick full-kit presets (home + away) for that FIFA-career feel. */
const PRESETS: { name: string; kit1: Kit; kit2: Kit; pat1: KitPattern; pat2: KitPattern }[] = [
  { name: "Neon", kit1: ["#00FF87", "#0B1120"], kit2: ["#F4F7F5", "#0B1120"], pat1: "solid", pat2: "solid" },
  { name: "Canarinho", kit1: ["#F4C20D", "#0F4C9C"], kit2: ["#0F2C66", "#F4C20D"], pat1: "solid", pat2: "solid" },
  { name: "Albiceleste", kit1: ["#74ACDF", "#FFFFFF"], kit2: ["#0F2C66", "#74ACDF"], pat1: "vstripe", pat2: "solid" },
  { name: "Fúria", kit1: ["#C0182B", "#F4C20D"], kit2: ["#101418", "#C0182B"], pat1: "solid", pat2: "sash" },
  { name: "Cruz-Maltino", kit1: ["#101418", "#F4F7F5"], kit2: ["#F4F7F5", "#101418"], pat1: "sash", pat2: "sash" },
  { name: "Rubro-Negro", kit1: ["#C0182B", "#101418"], kit2: ["#F4F7F5", "#101418"], pat1: "hoops", pat2: "solid" },
];

function ColorRow({
  label, value, onPick,
}: {
  label: string;
  value: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div>
      <div className="font-arc text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)] opacity-70 mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {SWATCHES.map((c) => {
          const on = c.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={c}
              data-sound="confirm"
              onClick={() => onPick(c)}
              aria-label={c}
              className={`w-7 h-7 rounded-md border-[3px] border-[var(--ink)] transition-transform ${
                on ? "scale-110 shadow-[2px_2px_0_var(--ink)]" : "hover:-translate-y-0.5"
              }`}
              style={{ background: c, outline: on ? "2px solid var(--ink)" : "none", outlineOffset: "2px" }}
            />
          );
        })}
        <label
          className="relative w-7 h-7 rounded-md border-[3px] border-dashed border-[var(--ink)] grid place-items-center cursor-pointer overflow-hidden"
          title="Cor livre"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onPick(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <span className="font-arc text-base font-black text-[var(--ink)] leading-none pointer-events-none">+</span>
        </label>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const career = useCareer();
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState<Step>("menu");
  const [name, setName] = useState("");
  const [langOpen, setLangOpen] = useState(false);
  const [pickedEd, setPickedEd] = useState<string | null>(null);
  const [kit1, setKit1] = useState<Kit>([...USER_COLORS]);
  const [kit2, setKit2] = useState<Kit>([...USER_KIT2]);
  const [pat1, setPat1] = useState<KitPattern>("solid");
  const [pat2, setPat2] = useState<KitPattern>("solid");
  const [activeKit, setActiveKit] = useState<1 | 2>(1);

  useEffect(() => {
    setMounted(true);
    sound.music("menu.theme");
    return () => sound.stopMusic();
  }, []);

  const hasCareer = mounted && career.coachName !== "";
  const continueHref = !career.draftDone ? "/squad" : career.cup ? "/cup" : "/squad";

  const active = activeKit === 1 ? kit1 : kit2;
  const setActive = activeKit === 1 ? setKit1 : setKit2;
  const activePat = activeKit === 1 ? pat1 : pat2;
  const setActivePat = activeKit === 1 ? setPat1 : setPat2;
  const setPrimary = (hex: string) => setActive([hex, active[1]]);
  const setSecondary = (hex: string) => setActive([active[0], hex]);

  function openEdition(editionId: string) { setPickedEd(editionId); }
  function startWithMode(editionId: string, mode: CupMode) {
    career.newCareer(name.trim() || "Mister", editionId, "4-2-3-1", mode, {
      kit1, kit2, pattern1: pat1, pattern2: pat2,
    });
    router.push("/squad");
  }

  return (
    <main className="arc-bg flex-1 flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      <SoundProvider />

      {/* language selector — inline position beats `.arc-bg > *{position:relative}` (same specificity, source-order trap) */}
      <div
        style={{ position: "fixed", top: "16px", right: "16px", left: "auto", margin: 0, zIndex: 200 }}
      >
        <button
          data-sound="confirm"
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
                  data-sound={l.active ? "confirm" : undefined}
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
        <h1 className="arc-logo select-none text-[clamp(4.2rem,15vw,10.5rem)] mt-3 mb-5">
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
                data-sound="confirm"
                onClick={() => setStep("coach")}
                className="arc-btn arc-btn--card w-full py-4"
              >
                <span className="block text-2xl leading-tight">Novo campeonato</span>
                <span className="block font-arc text-[11px] font-bold opacity-75 mt-0.5">monta tua seleção de lendas e vai pra cima</span>
              </button>
              {hasCareer && (
                <button
                  data-sound="confirm"
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
              <span className="arc-tag">★ Passo 1 de 3</span>
              <h2 className="font-display text-3xl mt-3 mb-1 text-[var(--ink)]">QUEM É O TÉCNICO?</h2>
              <p className="font-arc text-sm font-semibold opacity-65 mb-4 text-[var(--ink)]">
                Sua seleção leva o seu nome na prancheta.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && name.trim() && setStep("kit")}
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
                <button data-sound="cancel" onClick={() => setStep("menu")} className="arc-btn arc-btn--paper flex-1 py-2.5 text-sm">Voltar</button>
                <button
                  data-sound="confirm"
                  onClick={() => setStep("kit")}
                  disabled={!name.trim()}
                  className="arc-btn arc-btn--lima flex-1 py-2.5 text-sm"
                >
                  Desenhar o uniforme
                </button>
              </div>
            </motion.div>
          )}

          {step === "kit" && (
            <motion.div
              key="kit"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="arc-panel p-5 sm:p-6 max-w-2xl mx-auto text-left"
            >
              <span className="arc-tag">★ Passo 2 de 3</span>
              <h2 className="font-display text-3xl mt-3 mb-1 text-[var(--ink)]">O UNIFORME DA SELEÇÃO</h2>
              <p className="font-arc text-sm font-semibold opacity-65 mb-4 text-[var(--ink)]">
                As cores que entram em campo. Monte o uniforme de casa e o de visitante.
              </p>

              {/* home / away tabs */}
              <div className="flex gap-2 mb-4">
                {([1, 2] as const).map((k) => (
                  <button
                    key={k}
                    data-sound="confirm"
                    onClick={() => setActiveKit(k)}
                    className={`flex-1 py-2 rounded-xl border-[3px] border-[var(--ink)] font-arc text-xs font-extrabold uppercase tracking-wider transition-all ${
                      activeKit === k
                        ? "bg-[var(--amarelo)] text-[var(--ink)] shadow-[3px_4px_0_var(--ink)]"
                        : "bg-white text-[var(--ink)] opacity-60 hover:opacity-100"
                    }`}
                  >
                    {k === 1 ? "Casa" : "Visitante"}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-[150px_1fr] gap-5 items-start">
                {/* preview column */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-full bg-white rounded-2xl border-[3px] border-[var(--ink)] shadow-[3px_4px_0_var(--ink)] p-4 grid place-items-center">
                    <KitJersey primary={active[0]} secondary={active[1]} pattern={activePat} className="w-28 h-auto" />
                  </div>
                  <button
                    data-sound="confirm"
                    onClick={() => setActiveKit(activeKit === 1 ? 2 : 1)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border-[2.5px] border-[var(--ink)] bg-white hover:-translate-y-0.5 transition-transform"
                    title="Ver o outro uniforme"
                  >
                    <KitJersey
                      primary={(activeKit === 1 ? kit2 : kit1)[0]}
                      secondary={(activeKit === 1 ? kit2 : kit1)[1]}
                      pattern={activeKit === 1 ? pat2 : pat1}
                      className="w-6 h-auto"
                    />
                    <span className="font-arc text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink)]">
                      {activeKit === 1 ? "Visitante" : "Casa"}
                    </span>
                  </button>
                </div>

                {/* controls column */}
                <div className="space-y-4">
                  <div>
                    <div className="font-arc text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)] opacity-70 mb-1.5">
                      Modelo da camisa
                    </div>
                    <div className="grid grid-cols-5 gap-1.5">
                      {PATTERNS.map((p) => {
                        const on = activePat === p.id;
                        return (
                          <button
                            key={p.id}
                            data-sound="confirm"
                            onClick={() => setActivePat(p.id)}
                            title={p.label}
                            className={`flex flex-col items-center gap-0.5 rounded-lg border-[2.5px] py-1.5 transition-all ${
                              on
                                ? "border-[var(--ink)] bg-[var(--amarelo)] shadow-[2px_3px_0_var(--ink)]"
                                : "border-[rgba(20,21,18,0.25)] bg-white hover:border-[var(--ink)]"
                            }`}
                          >
                            <KitJersey primary={active[0]} secondary={active[1]} pattern={p.id} className="w-7 h-auto" />
                            <span className="font-arc text-[8px] font-extrabold uppercase tracking-wide text-[var(--ink)] leading-none">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <ColorRow label="Cor primária" value={active[0]} onPick={setPrimary} />
                  <ColorRow label="Cor secundária (gola / mangas)" value={active[1]} onPick={setSecondary} />

                  <div>
                    <div className="font-arc text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)] opacity-70 mb-1.5">
                      Uniformes prontos
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESETS.map((p) => (
                        <button
                          key={p.name}
                          data-sound="confirm"
                          onClick={() => { setKit1([...p.kit1]); setKit2([...p.kit2]); setPat1(p.pat1); setPat2(p.pat2); }}
                          className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full border-[2.5px] border-[var(--ink)] bg-white hover:-translate-y-0.5 transition-transform"
                        >
                          <span className="flex -space-x-1">
                            <span className="w-4 h-4 rounded-full border-2 border-[var(--ink)]" style={{ background: p.kit1[0] }} />
                            <span className="w-4 h-4 rounded-full border-2 border-[var(--ink)]" style={{ background: p.kit2[0] }} />
                          </span>
                          <span className="font-arc text-[10px] font-extrabold uppercase tracking-wide text-[var(--ink)]">{p.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-5">
                <button data-sound="cancel" onClick={() => setStep("coach")} className="arc-btn arc-btn--paper flex-1 py-2.5 text-sm">Voltar</button>
                <button data-sound="confirm" onClick={() => setStep("edition")} className="arc-btn arc-btn--lima flex-1 py-2.5 text-sm">
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
              <span className="arc-tag">★ Passo 3 de 3</span>
              <h2 className="font-display text-3xl mt-3 mb-3 text-[var(--ink)]">EM QUAL COPA DO MUNDO?</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="sm:w-44 shrink-0 arc-mini p-3 self-start">
                  <div className="font-arc text-[10px] font-extrabold uppercase tracking-widest text-[var(--gold)] mb-1">Dica do mister</div>
                  <p className="font-arc text-[11px] font-semibold leading-snug text-[var(--ink)] opacity-80">
                    Cada Copa tem regras próprias. Ao escolher, decida: <b>Fiel</b> (o formato real
                    daquele ano) ou <b>Tradicional</b> (o formato de hoje, 48 seleções, com o estádio
                    e o clima da época).
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[44vh] overflow-y-auto pr-1 flex-1">
                  {EDITIONS.map((e) => (
                    <button
                      key={e.id}
                      data-sound="confirm"
                      onClick={() => openEdition(e.id)}
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
              </div>
              <button data-sound="cancel" onClick={() => setStep("kit")} className="arc-btn arc-btn--paper w-full py-2.5 mt-4 text-sm">
                Voltar
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Popup de modo (Fiel/Tradicional) com "?" lore */}
      <AnimatePresence>
        {pickedEd && (() => {
          const ed = EDITION_BY_ID[pickedEd];
          const fiel = fielAvailable(pickedEd);
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70"
              onClick={() => setPickedEd(null)}
            >
              <motion.div
                initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }}
                className="arc-panel p-5 sm:p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}
              >
                <div className="text-3xl mb-1">{ed.flag}</div>
                <h3 className="font-display text-2xl text-[var(--ink)]">{editionLabel(ed)}</h3>
                {ed.lore && (
                  <div className="arc-mini p-3 my-3 flex gap-2">
                    <span className="font-display text-lg text-[var(--gold)] shrink-0">?</span>
                    <p className="font-arc text-[11px] font-semibold leading-snug text-[var(--ink)] opacity-80">{ed.lore}</p>
                  </div>
                )}
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    data-sound="confirm" disabled={!fiel}
                    onClick={() => startWithMode(pickedEd, "fiel")}
                    className={`arc-btn arc-btn--lima w-full py-3 ${fiel ? "" : "opacity-40 pointer-events-none"}`}
                  >
                    <span className="block font-display text-lg">JOGAR FIEL</span>
                    <span className="block font-arc text-[10px] font-bold opacity-75">
                      {fiel ? "o formato real daquela Copa" : "Modo Fiel em breve nesta Copa"}
                    </span>
                  </button>
                  <button
                    data-sound="confirm"
                    onClick={() => startWithMode(pickedEd, "tradicional")}
                    className="arc-btn arc-btn--ciano w-full py-3"
                  >
                    <span className="block font-display text-lg">JOGAR TRADICIONAL</span>
                    <span className="block font-arc text-[10px] font-bold opacity-75">formato de hoje (48 times) com o tema de {ed.year}</span>
                  </button>
                  <button data-sound="cancel" onClick={() => setPickedEd(null)} className="arc-btn arc-btn--paper w-full py-2 text-sm mt-1">Voltar</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </main>
  );
}
