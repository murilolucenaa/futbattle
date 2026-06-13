"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import { useCareer } from "@/lib/game/store";
import {
  roundLabel, groupTable, nextUserFixture, thirdPlaceTable, leaders, podium,
} from "@/lib/game/cup";
import { engineFor } from "@/lib/game/formats/registry";
import { SQUAD_BY_ID, squadCode } from "@/lib/data/squads";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { IconAssist, IconBall, IconStadium, IconStar, IconTrophy } from "@/components/icons";
import type { CupState, Fixture } from "@/lib/game/types";

function shortTeam(cup: CupState, id: string): string {
  if (id === "USER") return cup.teams[id].name;
  const s = SQUAD_BY_ID[id];
  return s ? squadCode(s) : cup.teams[id].name;
}

function TeamLabel({ cup, id, compact, className }: { cup: CupState; id: string; compact?: boolean; className?: string }) {
  const t = cup.teams[id];
  const label = compact ? shortTeam(cup, id) : t.name;
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 font-arc font-extrabold uppercase tracking-tight ${
        id === "USER" ? "text-[var(--accent)]" : "text-[var(--ink)]"
      } ${className ?? ""}`}
    >
      <span className="shrink-0 normal-case leading-none">{t.flag}</span>
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

/** Hero matchup side: big flag + Anton name, overflow-safe (min-w-0 + truncate). */
function HeroSide({ cup, id, align }: { cup: CupState; id: string; align: "left" | "right" }) {
  const t = cup.teams[id];
  const isUser = id === "USER";
  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 ${align === "right" ? "flex-row-reverse text-right" : "text-left"}`}>
      <span className="shrink-0 text-3xl leading-none sm:text-4xl">{t.flag}</span>
      <span className={`min-w-0 truncate font-display text-2xl leading-none sm:text-3xl ${isUser ? "text-[var(--accent)]" : ""}`}>
        {t.name}
      </span>
    </div>
  );
}

function FixtureRow({ cup, f, onClick }: { cup: CupState; f: Fixture; onClick?: () => void }) {
  const played = f.scoreH !== null;
  return (
    <button
      onClick={onClick}
      disabled={!onClick || !played}
      className={`w-full flex items-center gap-2 py-1.5 px-1.5 rounded-xl text-left ${onClick && played ? "hover:bg-[rgba(20,21,18,0.06)] transition-colors" : "cursor-default"}`}
    >
      <div className="flex flex-1 min-w-0 justify-end text-[12.5px]"><TeamLabel cup={cup} id={f.homeId} /></div>
      <div className={`shrink-0 min-w-[3.4rem] text-center rounded-lg border-[2.5px] border-[var(--ink)] px-2 py-0.5 leading-none ${
        played ? "bg-[var(--ink)] text-[var(--paper)]" : "bg-transparent text-[rgba(20,21,18,0.55)]"
      }`}>
        {played ? (
          <span className="font-display text-[15px]">{f.scoreH}<span className="opacity-50 mx-0.5">–</span>{f.scoreA}</span>
        ) : (
          <span className="font-arc text-[11px] font-extrabold tracking-[0.15em]">VS</span>
        )}
        {f.pensH != null && <span className="block font-arc text-[9px] font-bold leading-none opacity-70 mt-0.5">pen {f.pensH}–{f.pensA}</span>}
      </div>
      <div className="flex flex-1 min-w-0 text-[12.5px]"><TeamLabel cup={cup} id={f.awayId} /></div>
    </button>
  );
}

export default function CupPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"groups" | "leaders" | "bracket">("groups");
  const [detail, setDetail] = useState<Fixture | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    if (c.coachName === "") { router.replace("/"); return; }
    if (!c.cup) router.replace("/squad");
  }, [mounted, c.coachName, c.cup, router]);

  if (!mounted || !c.cup) return null;
  const cup = c.cup;
  const next = nextUserFixture(cup);
  const isOver = cup.phase === "champion" || cup.phase === "eliminated";
  const pod = podium(cup);
  const ed = EDITION_BY_ID[cup.editionId];
  const engine = engineFor(cup.mode, cup.editionId);
  const modeLabel = cup.mode === "fiel" ? `formato ${ed?.year ?? ""} (Fiel)` : "formato 2026 · 48 seleções";

  return (
    <>
      <TopBar />
      <main className="arc-bg flex-1 w-full">
        <div className="mx-auto max-w-6xl w-full px-4 py-6">
        <div className="font-arc text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/85 mb-3 flex items-center gap-2">
          <IconTrophy size={14} className="text-[var(--amarelo)]" />
          Copa do Mundo FUTBATTLE {ed ? `· ${editionLabel(ed)}` : ""} · {modeLabel}
        </div>

        {/* "?" mini-história imersiva da edição */}
        {ed?.lore && (
          <div className="arc-mini p-2.5 mb-4 flex gap-2 items-start">
            <span className="font-display text-base text-[var(--gold)] shrink-0">?</span>
            <p className="font-arc text-[11px] font-semibold leading-snug opacity-80">{ed.lore}</p>
          </div>
        )}

        {/* Status hero */}
        {cup.phase === "champion" ? (
          <ChampionBanner name={cup.teams.USER.name} />
        ) : next ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="arc-panel p-6 mb-6 relative overflow-hidden"
          >
            <span className="arc-tag mb-2">★ {roundLabel(cup, next.round)}{next.group ? ` · Grupo ${next.group}` : ""}</span>
            {next.stadium && (
              <div className="text-xs text-[var(--muted)] mb-2 flex items-center gap-1.5">
                <IconStadium size={13} /> {next.stadium}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <HeroSide cup={cup} id={next.homeId} align="right" />
                <span className="shrink-0 font-arc text-sm font-extrabold uppercase tracking-[0.2em] text-[var(--muted)]">vs</span>
                <HeroSide cup={cup} id={next.awayId} align="left" />
              </div>
              <button data-sound="confirm" onClick={() => router.push("/match")} className="arc-btn arc-btn--rosa arc-btn--card px-8 py-3 shrink-0">
                <span className="block text-xl leading-tight">Bora pro jogo</span>
                <span className="block font-arc text-[10px] font-bold opacity-80 mt-0.5">aquece que é sua vez, mister</span>
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="arc-panel p-6 mb-6 text-center">
            <h2 className="font-display text-3xl mb-1">
              {isOver || !next ? "Sua seleção foi eliminada" : "Copa encerrada"}
            </h2>
            {pod && (
              <div className="flex justify-center gap-6 my-4 flex-wrap">
                {([["Campeão", pod[0], "var(--gold)"], ["Vice", pod[1], "var(--muted)"], ["3º lugar", pod[2], "#C47A3D"]] as const).map(([label, id, color]) => (
                  <div key={label} className="text-center">
                    <div className="text-[10px] uppercase tracking-widest font-bold mb-1" style={{ color }}>{label}</div>
                    <div className="font-display text-lg">{cup.teams[id].flag} {cup.teams[id].name}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm text-[var(--muted)] mb-4">
              Acompanhe o desfecho abaixo — ou comece uma nova campanha.
            </p>
            <button data-sound="confirm" onClick={() => router.push("/")} className="arc-btn arc-btn--lima px-6 py-3 text-base">Nova campanha</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([["groups", "Fase de grupos"], ["leaders", "Líderes"], ["bracket", "Mata-mata"]] as const).map(([k, label]) => (
            <button
              key={k}
              data-sound="confirm"
              onClick={() => setTab(k)}
              className={`arc-btn px-5 py-1.5 text-xs ${tab === k ? "" : "arc-btn--paper"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "groups" && <GroupsTab cup={cup} onFixture={setDetail} />}
        {tab === "leaders" && <LeadersTab cup={cup} />}
        {tab === "bracket" && <BracketTab cup={cup} onFixture={setDetail} />}

        {/* fixture insight modal */}
        <AnimatePresence>
          {detail && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
              onClick={() => setDetail(null)}
            >
              <motion.div
                initial={{ scale: 0.93, y: 14 }} animate={{ scale: 1, y: 0 }}
                className="arc-panel p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-arc text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--gold)] mb-1 text-center">
                  {roundLabel(cup, detail.round)} {detail.group ? `· Grupo ${detail.group}` : ""}
                </div>
                {detail.stadium && (
                  <div className="text-xs text-[var(--muted)] text-center mb-3 flex items-center justify-center gap-1.5">
                    <IconStadium size={13} /> {detail.stadium}
                  </div>
                )}
                <div className="flex items-center justify-center gap-3 mb-1 text-lg">
                  <TeamLabel cup={cup} id={detail.homeId} />
                  <span className="font-display text-3xl text-[var(--accent)] shrink-0">{detail.scoreH}–{detail.scoreA}</span>
                  <TeamLabel cup={cup} id={detail.awayId} />
                </div>
                {detail.pensH != null && (
                  <div className="text-sm text-[var(--gold)] font-bold text-center mb-2">
                    Pênaltis: {detail.pensH}–{detail.pensA}
                  </div>
                )}
                {detail.scorers && detail.scorers.length > 0 ? (
                  <div className="mt-4 space-y-1.5">
                    {detail.scorers.map((s, i) => (
                      <div key={i} className={`flex items-center gap-2 text-sm ${s.side === "a" ? "flex-row-reverse" : ""}`}>
                        <IconBall size={13} className="text-[var(--accent)] shrink-0" />
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-xs text-[var(--muted)]">{s.min}&apos;</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-sm text-[var(--muted)] mt-4">Sem gols — jogo truncado.</p>
                )}
                <button data-sound="cancel" onClick={() => setDetail(null)} className="arc-btn arc-btn--paper w-full py-2.5 mt-5 text-sm">Fechar</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </>
  );
}

// ── Groups ───────────────────────────────────────────────────
function GroupsTab({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const groupNames = Object.keys(cup.groups).filter((g) => g !== "FINAL").sort();
  const engine = engineFor(cup.mode, cup.editionId);
  const usesThirds = engine.id === "g24" || engine.id === "g48";
  const isFinalGroup = engine.id === "finalGroup1950";
  const thirdsCount = engine.id === "g48" ? 8 : 4;
  const [sel, setSel] = useState(cup.userGroup);
  const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
  const thirds = groupsDone && usesThirds ? thirdPlaceTable(cup).slice(0, thirdsCount).map((r) => r.teamId) : [];
  const table = groupTable(cup, sel);
  const groupRounds = [...new Set(cup.fixtures.filter((f) => f.group === sel).map((f) => f.round))].sort((a, b) => a - b);

  return (
    <div>
      {/* group selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {groupNames.map((g) => (
          <button
            key={g}
            data-sound="confirm"
            onClick={() => setSel(g)}
            className={`arc-btn arc-btn--card w-10 h-10 font-display text-base relative ${sel === g ? "" : "arc-btn--paper"}`}
          >
            {g}
            {g === cup.userGroup && (
              <span className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full bg-[var(--rosa)] border-2 border-[var(--ink)]" title="seu grupo" />
            )}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        {/* standings */}
        <motion.div key={sel} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`arc-panel p-4 ${sel === cup.userGroup ? "ring-[3px] ring-[var(--amarelo)]" : ""}`}>
          <h3 className="font-display text-xl mb-3">
            Grupo {sel} {sel === cup.userGroup && <span className="text-[var(--accent)] text-sm">· seu grupo</span>}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="font-arc text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
                <th className="text-left pb-1.5 w-8">Pos</th>
                <th className="text-left pb-1.5">Seleção</th>
                <th className="w-8">J</th>
                <th className="w-8">V</th>
                <th className="w-8">E</th>
                <th className="w-8">D</th>
                <th className="w-14">GP-GC</th>
                <th className="w-8">SG</th>
                <th className="w-9">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => {
                const qualThird = i === 2 && thirds.includes(row.teamId);
                return (
                  <tr
                    key={row.teamId}
                    className={`border-t border-[var(--border)] tabular-nums ${
                      i < 2 ? "bg-[rgba(154,205,30,0.28)]" : qualThird ? "bg-[rgba(255,200,27,0.3)]" : ""
                    }`}
                  >
                    <td className={`py-2 pl-1.5 text-xs font-bold border-l-[4px] ${i < 2 ? "border-[var(--lima)] text-[var(--accent)]" : qualThird ? "border-[var(--amarelo)] text-[var(--gold)]" : "border-transparent text-[var(--muted)]"}`}>{i + 1}º</td>
                    <td className="py-2 pr-2"><TeamLabel cup={cup} id={row.teamId} /></td>
                    <td className="text-center text-[var(--muted)]">{row.p}</td>
                    <td className="text-center text-[var(--muted)]">{row.w}</td>
                    <td className="text-center text-[var(--muted)]">{row.d}</td>
                    <td className="text-center text-[var(--muted)]">{row.l}</td>
                    <td className="text-center text-[var(--muted)]">{row.gf}-{row.ga}</td>
                    <td className="text-center text-[var(--muted)]">{row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga}</td>
                    <td className="text-center font-bold">{row.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[10px] text-[var(--muted)] mt-2">
            {usesThirds ? `1º e 2º avançam · os ${thirdsCount} melhores 3ºs completam o mata-mata.`
             : isFinalGroup ? "O 1º de cada grupo vai ao quadrangular final."
             : "1º e 2º de cada grupo avançam ao mata-mata."}
          </p>
        </motion.div>

        {/* group fixtures by round */}
        <div className="arc-panel p-4">
          <span className="arc-tag mb-3">★ Jogos do Grupo {sel}</span>
          {groupRounds.map((r) => (
            <div key={r} className="mb-2.5">
              <div className="font-arc text-[10px] font-extrabold text-[var(--gold)] uppercase tracking-[0.2em] mb-1">{roundLabel(cup, r)}</div>
              {cup.fixtures.filter((f) => f.group === sel && f.round === r).map((f) => (
                <div key={f.id}>
                  <FixtureRow cup={cup} f={f} onClick={() => onFixture(f)} />
                  {f.stadium && <div className="font-arc text-[9px] font-bold uppercase tracking-wide text-[rgba(20,21,18,0.45)] text-center -mt-0.5 mb-1.5">{f.stadium}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* thirds ranking once groups end (só formatos que usam melhores 3ºs) */}
      {groupsDone && usesThirds && (
        <div className="arc-panel p-4 mt-4">
          <h4 className="font-display text-lg mb-2">Ranking dos terceiros colocados</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {thirdPlaceTable(cup).map((row, i) => (
              <div key={row.teamId} className={`flex items-center gap-2 text-sm py-1 ${i < thirdsCount ? "" : "opacity-45"}`}>
                <span className={`w-6 text-xs font-bold ${i < thirdsCount ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{i + 1}º</span>
                <TeamLabel cup={cup} id={row.teamId} />
                <span className="ml-auto text-xs text-[var(--muted)]">{row.pts} pts · SG {row.gf - row.ga > 0 ? "+" : ""}{row.gf - row.ga}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaders ──────────────────────────────────────────────────
function LeadersTab({ cup }: { cup: CupState }) {
  const boards = [
    { key: "goals" as const, title: "Artilharia", icon: <IconBall size={16} />, value: (r: ReturnType<typeof leaders>[number]) => r.goals, suffix: "gols" },
    { key: "assists" as const, title: "Assistências", icon: <IconAssist size={16} />, value: (r: ReturnType<typeof leaders>[number]) => r.assists, suffix: "assist." },
    { key: "rating" as const, title: "Melhores notas", icon: <IconStar size={16} />, value: (r: ReturnType<typeof leaders>[number]) => r.avgRating.toFixed(2), suffix: "média" },
  ];
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {boards.map((b) => {
        const rows = leaders(cup, b.key, 10);
        return (
          <div key={b.key} className="arc-panel p-4">
            <h3 className="font-display text-lg mb-3 flex items-center gap-2 text-[var(--accent)]">
              {b.icon} {b.title}
            </h3>
            {rows.length === 0 && <p className="text-sm text-[var(--muted)]">Sem dados ainda — bola pra frente.</p>}
            <div className="space-y-1">
              {rows.map((r, i) => (
                <div key={r.playerId} className={`flex items-center gap-2 text-sm py-1.5 rounded-lg px-2 ${r.teamId === "USER" ? "bg-[rgba(154,205,30,0.28)]" : ""}`}>
                  <span className="w-5 text-xs font-bold text-[var(--muted)]">{i + 1}º</span>
                  <span className="shrink-0">{cup.teams[r.teamId]?.flag ?? ""}</span>
                  <span className="flex-1 truncate font-semibold">{r.name}</span>
                  <span className="font-display text-base text-[var(--gold)]">{b.value(r)}</span>
                  <span className="text-[9px] text-[var(--muted)] w-9">{b.suffix}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Bracket ──────────────────────────────────────────────────
function BracketTab({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const engine = engineFor(cup.mode, cup.editionId);

  // 1950: o "mata-mata" é um quadrangular final
  if (engine.id === "finalGroup1950") return <FinalGroupTab cup={cup} onFixture={onFixture} />;

  // formatos não-2026: chaveamento genérico por colunas de rounds knockout
  if (engine.id !== "g48") return <GenericBracket cup={cup} onFixture={onFixture} />;

  const anyKo = cup.fixtures.some((f) => f.knockout);
  if (!anyKo) {
    return (
      <div className="arc-panel p-10 text-center font-arc font-bold text-[rgba(20,21,18,0.6)]">
        O chaveamento dos 32 classificados aparece quando a fase de grupos terminar.
      </div>
    );
  }

  const fs = (round: number) => cup.fixtures.filter((f) => f.round === round).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  const r32 = fs(4), r16 = fs(5), qf = fs(6), sf = fs(7);
  const third = cup.fixtures.find((f) => f.round === 8) ?? null;
  const final = cup.fixtures.find((f) => f.round === 9) ?? null;

  const half = <T,>(arr: T[], side: 0 | 1): T[] => arr.slice(side * arr.length / 2, (side + 1) * arr.length / 2);

  function Tie({ f }: { f: Fixture | null }) {
    if (!f) return <div className="arc-mini px-2 py-2 text-center font-arc text-[10px] font-bold opacity-60">a definir</div>;
    const played = f.scoreH !== null;
    const isUser = f.homeId === "USER" || f.awayId === "USER";
    const win = played
      ? (f.scoreH! > f.scoreA! || (f.scoreH === f.scoreA && (f.pensH ?? 0) > (f.pensA ?? 0)) ? "h" : "a")
      : null;
    const row = (id: string, side: "h" | "a") => (
      <div className={`flex items-center justify-between gap-1.5 text-[11px] leading-tight ${win && win !== side ? "opacity-45" : "font-bold"}`}>
        <span className={`truncate font-arc font-extrabold uppercase tracking-tight ${id === "USER" ? "text-[var(--accent)]" : ""}`}>
          {cup.teams[id].flag} {shortTeam(cup, id)}
        </span>
        <span className="font-display shrink-0">
          {played ? (side === "h" ? f.scoreH : f.scoreA) : ""}
          {played && f.pensH != null && <span className="text-[8px] text-[var(--muted)]"> ({side === "h" ? f.pensH : f.pensA})</span>}
        </span>
      </div>
    );
    return (
      <button
        onClick={() => played && onFixture(f)}
        className={`arc-mini w-full px-2 py-1.5 space-y-1 text-left transition-all ${played ? "hover:-translate-y-px" : ""} ${isUser ? "ring-[2.5px] ring-[var(--amarelo)]" : ""}`}
      >
        {row(f.homeId, "h")}
        {row(f.awayId, "a")}
      </button>
    );
  }

  function Column({ ties, title, gap }: { ties: (Fixture | null)[]; title?: string; gap: string }) {
    return (
      <div className="flex flex-col justify-around min-w-0" style={{ rowGap: gap }}>
        {title && <div className="font-arc text-[9px] uppercase tracking-wider text-white/80 font-extrabold text-center -mb-1">{title}</div>}
        {ties.map((f, i) => <Tie key={f?.id ?? i} f={f} />)}
      </div>
    );
  }

  const pad = <T,>(arr: T[], n: number): (T | null)[] =>
    arr.length >= n ? (arr as (T | null)[]) : [...arr, ...Array<null>(n - arr.length).fill(null)];

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid gap-2 items-stretch min-w-[980px]" style={{ gridTemplateColumns: "1fr 1fr 1fr 1fr 1.15fr 1fr 1fr 1fr 1fr" }}>
        <Column title="16 avos" ties={pad(half(r32, 0), 8)} gap="0.4rem" />
        <Column title="Oitavas" ties={pad(half(r16, 0), 4)} gap="2rem" />
        <Column title="Quartas" ties={pad(half(qf, 0), 2)} gap="5rem" />
        <Column title="Semifinal" ties={pad(half(sf, 0), 1)} gap="0" />
        {/* center: final + 3rd place */}
        <div className="flex flex-col items-stretch justify-center gap-4">
          <div>
            <div className="text-center font-display text-[var(--amarelo)] text-lg mb-1 flex items-center justify-center gap-1.5 drop-shadow-[1px_2px_0_rgba(20,21,18,0.9)]">
              <IconTrophy size={16} /> FINAL
            </div>
            <Tie f={final} />
          </div>
          <div>
            <div className="text-center font-arc text-[9px] uppercase tracking-wider font-extrabold mb-1" style={{ color: "#E8B06A" }}>3º lugar</div>
            <Tie f={third} />
          </div>
        </div>
        <Column title="Semifinal" ties={pad(half(sf, 1), 1)} gap="0" />
        <Column title="Quartas" ties={pad(half(qf, 1), 2)} gap="5rem" />
        <Column title="Oitavas" ties={pad(half(r16, 1), 4)} gap="2rem" />
        <Column title="16 avos" ties={pad(half(r32, 1), 8)} gap="0.4rem" />
      </div>
      <p className="font-arc text-[10px] font-bold text-white/75 text-center mt-3">
        Toque num confronto para ver os detalhes — 8 chaves de cada lado, como na Copa de verdade.
      </p>
    </div>
  );
}

// Confronto de mata-mata reutilizável (genérico + 1950 não usa)
function KoTie({ cup, f, onFixture }: { cup: CupState; f: Fixture | null; onFixture: (f: Fixture) => void }) {
  if (!f) return <div className="arc-mini px-2 py-2 text-center font-arc text-[10px] font-bold opacity-60">a definir</div>;
  const played = f.scoreH !== null;
  const isUser = f.homeId === "USER" || f.awayId === "USER";
  const win = played
    ? (f.scoreH! > f.scoreA! || (f.scoreH === f.scoreA && (f.pensH ?? 0) > (f.pensA ?? 0)) ? "h" : "a")
    : null;
  const row = (id: string, side: "h" | "a") => (
    <div className={`flex items-center justify-between gap-1.5 text-[11px] leading-tight ${win && win !== side ? "opacity-45" : "font-bold"}`}>
      <span className={`truncate font-arc font-extrabold uppercase tracking-tight ${id === "USER" ? "text-[var(--accent)]" : ""}`}>{cup.teams[id].flag} {shortTeam(cup, id)}</span>
      <span className="font-display shrink-0">
        {played ? (side === "h" ? f.scoreH : f.scoreA) : ""}
        {played && f.pensH != null && <span className="text-[8px] text-[var(--muted)]"> ({side === "h" ? f.pensH : f.pensA})</span>}
      </span>
    </div>
  );
  return (
    <button
      onClick={() => played && onFixture(f)}
      className={`arc-mini w-full px-2 py-1.5 space-y-1 text-left transition-all ${played ? "hover:-translate-y-px" : ""} ${isUser ? "ring-[2.5px] ring-[var(--amarelo)]" : ""}`}
    >
      {row(f.homeId, "h")}
      {row(f.awayId, "a")}
    </button>
  );
}

// Chaveamento genérico (16/24/32): colunas por round de mata-mata
function GenericBracket({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const koRounds = [...new Set(cup.fixtures.filter((f) => f.knockout).map((f) => f.round))].sort((a, b) => a - b);
  if (koRounds.length === 0) {
    return (
      <div className="arc-panel p-10 text-center font-arc font-bold text-[rgba(20,21,18,0.6)]">
        O chaveamento aparece quando a fase de grupos terminar.
      </div>
    );
  }
  const fs = (round: number) => cup.fixtures.filter((f) => f.round === round).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
  return (
    <div className="arc-panel p-4 overflow-x-auto">
      <div className="flex gap-3 min-w-max items-stretch">
        {koRounds.map((r) => (
          <div key={r} className="flex flex-col justify-around gap-2 min-w-[160px]">
            <div className="font-arc text-[9px] uppercase tracking-wider text-white/80 font-extrabold text-center">{roundLabel(cup, r)}</div>
            {fs(r).map((f) => <KoTie key={f.id} cup={cup} f={f} onFixture={onFixture} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

// Quadrangular final (1950): tabela do grupo "FINAL"
function FinalGroupTab({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const fg = cup.groups["FINAL"];
  if (!fg) {
    return (
      <div className="arc-panel p-10 text-center font-arc font-bold text-[rgba(20,21,18,0.6)]">
        O quadrangular final aparece quando a 1ª fase terminar.
      </div>
    );
  }
  const table = groupTable(cup, "FINAL");
  const games = cup.fixtures.filter((f) => f.group === "FINAL");
  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
      <div className="arc-panel p-4 ring-[3px] ring-[var(--amarelo)]">
        <h3 className="font-display text-xl mb-3 flex items-center gap-2"><IconTrophy size={18} className="text-[var(--amarelo)]" /> Grupo Final</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="font-arc text-[10px] font-extrabold uppercase tracking-wider text-[var(--muted)]">
              <th className="text-left pb-1.5 w-8">Pos</th>
              <th className="text-left pb-1.5">Seleção</th>
              <th className="w-8">J</th><th className="w-8">V</th>
              <th className="w-8">E</th><th className="w-8">D</th>
              <th className="w-14">GP-GC</th><th className="w-9">Pts</th>
            </tr>
          </thead>
          <tbody>
            {table.map((row, i) => (
              <tr key={row.teamId} className={`border-t border-[var(--border)] tabular-nums ${i === 0 ? "bg-[rgba(255,200,27,0.3)]" : ""}`}>
                <td className={`py-2 pl-1.5 text-xs font-bold border-l-[4px] ${i === 0 ? "border-[var(--amarelo)] text-[var(--gold)]" : "border-transparent text-[var(--muted)]"}`}>{i + 1}º</td>
                <td className="py-2 pr-2"><TeamLabel cup={cup} id={row.teamId} /></td>
                <td className="text-center text-[var(--muted)]">{row.p}</td>
                <td className="text-center text-[var(--muted)]">{row.w}</td>
                <td className="text-center text-[var(--muted)]">{row.d}</td>
                <td className="text-center text-[var(--muted)]">{row.l}</td>
                <td className="text-center text-[var(--muted)]">{row.gf}-{row.ga}</td>
                <td className="text-center font-bold">{row.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-[var(--muted)] mt-2">Campeão = líder do quadrangular. Sem final única — é o Maracanazo.</p>
      </div>
      <div className="arc-panel p-4">
        <span className="arc-tag mb-3">★ Jogos do quadrangular</span>
        {games.map((f) => (
          <div key={f.id}>
            <FixtureRow cup={cup} f={f} onClick={() => onFixture(f)} />
            {f.stadium && <div className="text-[9px] text-[var(--muted)] text-center -mt-0.5 mb-1">{f.stadium}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ChampionBanner({ name }: { name: string }) {
  const pieces = Array.from({ length: 36 });
  return (
    <div className="arc-panel p-10 mb-6 text-center relative overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti absolute w-2 h-3 rounded-sm pointer-events-none"
          style={{
            left: `${(i * 137) % 100}%`,
            background: ["#FFC53D", "#00FF87", "#4DA3FF", "#FF4D5E", "#EAF2EC"][i % 5],
            animationDuration: `${2.4 + (i % 5) * 0.7}s`,
            animationDelay: `${(i % 8) * 0.35}s`,
            animationIterationCount: "infinite",
          }}
          aria-hidden
        />
      ))}
      <IconTrophy size={56} className="mx-auto mb-3 text-[var(--gold)]" />
      <h2 className="font-display text-4xl mb-2 text-[var(--gold)]">CAMPEÃO DO MUNDO!</h2>
      <p className="text-lg">
        <span className="text-[var(--accent)] font-bold">{name}</span> conquistou a Copa FUTBATTLE. Lenda eterna.
      </p>
    </div>
  );
}
