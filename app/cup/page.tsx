"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import TopBar from "@/components/TopBar";
import { useCareer } from "@/lib/game/store";
import {
  GROUP_NAMES, ROUND_LABEL, groupTable, nextUserFixture, thirdPlaceTable, leaders, podium,
} from "@/lib/game/cup";
import { SQUAD_BY_ID, squadCode } from "@/lib/data/squads";
import { EDITION_BY_ID, editionLabel } from "@/lib/data/editions";
import { IconAssist, IconBall, IconStadium, IconStar, IconTrophy } from "@/components/icons";
import type { CupState, Fixture } from "@/lib/game/types";

function shortTeam(cup: CupState, id: string): string {
  if (id === "USER") return cup.teams[id].name;
  const s = SQUAD_BY_ID[id];
  return s ? squadCode(s) : cup.teams[id].name;
}

function TeamLabel({ cup, id, bold, compact }: { cup: CupState; id: string; bold?: boolean; compact?: boolean }) {
  const t = cup.teams[id];
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${id === "USER" ? "text-[var(--accent)] font-bold" : bold ? "font-semibold" : ""}`}>
      <span className="shrink-0">{t.flag}</span>
      <span className="truncate">{compact ? shortTeam(cup, id) : t.name}</span>
    </span>
  );
}

function FixtureRow({ cup, f, onClick }: { cup: CupState; f: Fixture; onClick?: () => void }) {
  const played = f.scoreH !== null;
  return (
    <button
      onClick={onClick}
      disabled={!onClick || !played}
      className={`w-full flex items-center gap-2 text-sm py-1.5 rounded-lg px-1 text-left ${onClick && played ? "hover:bg-[var(--surface)] transition-colors" : "cursor-default"}`}
    >
      <div className="flex-1 text-right min-w-0 flex justify-end"><TeamLabel cup={cup} id={f.homeId} /></div>
      <div className={`shrink-0 px-2.5 py-0.5 rounded-lg font-display text-base min-w-[3.5rem] text-center ${
        played ? "bg-[var(--surface-2)]" : "bg-[var(--surface)] text-[var(--muted)]"
      }`}>
        {played ? `${f.scoreH} – ${f.scoreA}` : "vs"}
        {f.pensH != null && <span className="text-[10px] block leading-none text-[var(--muted)]">pen {f.pensH}–{f.pensA}</span>}
      </div>
      <div className="flex-1 min-w-0"><TeamLabel cup={cup} id={f.awayId} /></div>
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

  return (
    <>
      <TopBar />
      <main className="arc-bg flex-1 w-full">
        <div className="mx-auto max-w-6xl w-full px-4 py-6">
        <div className="font-arc text-[10px] font-extrabold uppercase tracking-[0.3em] text-white/85 mb-3 flex items-center gap-2">
          <IconTrophy size={14} className="text-[var(--amarelo)]" />
          Copa do Mundo FUTBATTLE {ed ? `· ${editionLabel(ed)}` : ""} · formato 2026 · 48 seleções
        </div>

        {/* Status hero */}
        {cup.phase === "champion" ? (
          <ChampionBanner name={cup.teams.USER.name} />
        ) : next ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="arc-panel p-6 mb-6 relative overflow-hidden"
          >
            <span className="arc-tag mb-2">★ {ROUND_LABEL[next.round]}{next.group ? ` · Grupo ${next.group}` : ""}</span>
            {next.stadium && (
              <div className="text-xs text-[var(--muted)] mb-2 flex items-center gap-1.5">
                <IconStadium size={13} /> {next.stadium}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="font-display text-2xl sm:text-3xl flex items-center gap-3 min-w-0">
                <TeamLabel cup={cup} id={next.homeId} bold />
                <span className="text-[var(--muted)]">x</span>
                <TeamLabel cup={cup} id={next.awayId} bold />
              </div>
              <button data-sfx="confirm" onClick={() => router.push("/match")} className="arc-btn arc-btn--rosa arc-btn--card px-8 py-3">
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
            <button data-sfx="confirm" onClick={() => router.push("/")} className="arc-btn arc-btn--lima px-6 py-3 text-base">Nova campanha</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([["groups", "Fase de grupos"], ["leaders", "Líderes"], ["bracket", "Mata-mata"]] as const).map(([k, label]) => (
            <button
              key={k}
              data-sfx="click"
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
                  {ROUND_LABEL[detail.round]} {detail.group ? `· Grupo ${detail.group}` : ""}
                </div>
                {detail.stadium && (
                  <div className="text-xs text-[var(--muted)] text-center mb-3 flex items-center justify-center gap-1.5">
                    <IconStadium size={13} /> {detail.stadium}
                  </div>
                )}
                <div className="font-display text-2xl flex items-center justify-center gap-3 mb-1">
                  <TeamLabel cup={cup} id={detail.homeId} bold />
                  <span className="text-3xl text-[var(--accent)]">{detail.scoreH}–{detail.scoreA}</span>
                  <TeamLabel cup={cup} id={detail.awayId} bold />
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
                <button data-sfx="back" onClick={() => setDetail(null)} className="arc-btn arc-btn--paper w-full py-2.5 mt-5 text-sm">Fechar</button>
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
  const [sel, setSel] = useState(cup.userGroup);
  const groupsDone = cup.fixtures.filter((f) => f.round <= 3).every((f) => f.scoreH !== null);
  const thirds = groupsDone ? thirdPlaceTable(cup).slice(0, 8).map((r) => r.teamId) : [];
  const table = groupTable(cup, sel);

  return (
    <div>
      {/* group selector A–L */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {GROUP_NAMES.map((g) => (
          <button
            key={g}
            data-sfx="click"
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
              <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                <th className="text-left font-semibold pb-1.5 w-8">Pos</th>
                <th className="text-left font-semibold pb-1.5">Seleção</th>
                <th className="w-8 font-semibold">J</th>
                <th className="w-8 font-semibold">V</th>
                <th className="w-8 font-semibold">E</th>
                <th className="w-8 font-semibold">D</th>
                <th className="w-14 font-semibold">GP-GC</th>
                <th className="w-8 font-semibold">SG</th>
                <th className="w-9 font-semibold">Pts</th>
              </tr>
            </thead>
            <tbody>
              {table.map((row, i) => {
                const qualThird = i === 2 && thirds.includes(row.teamId);
                return (
                  <tr
                    key={row.teamId}
                    className={`border-t border-[var(--border)] ${
                      i < 2 ? "bg-[rgba(154,205,30,0.28)]" : qualThird ? "bg-[rgba(255,200,27,0.3)]" : ""
                    }`}
                  >
                    <td className={`py-2 text-xs font-bold ${i < 2 ? "text-[var(--accent)]" : qualThird ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{i + 1}º</td>
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
            1º e 2º avançam · 3º disputa as 8 melhores campanhas entre os 12 grupos.
          </p>
        </motion.div>

        {/* group fixtures by round */}
        <div className="arc-panel p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--muted)] mb-2">Jogos do Grupo {sel}</h4>
          {[1, 2, 3].map((r) => (
            <div key={r} className="mb-2">
              <div className="text-[10px] font-bold text-[var(--gold)] uppercase tracking-wider mb-0.5">{ROUND_LABEL[r]}</div>
              {cup.fixtures.filter((f) => f.group === sel && f.round === r).map((f) => (
                <div key={f.id}>
                  <FixtureRow cup={cup} f={f} onClick={() => onFixture(f)} />
                  {f.stadium && <div className="text-[9px] text-[var(--muted)] text-center -mt-0.5 mb-1">{f.stadium}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* thirds ranking once groups end */}
      {groupsDone && (
        <div className="arc-panel p-4 mt-4">
          <h4 className="font-display text-lg mb-2">Ranking dos terceiros colocados</h4>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
            {thirdPlaceTable(cup).map((row, i) => (
              <div key={row.teamId} className={`flex items-center gap-2 text-sm py-1 ${i < 8 ? "" : "opacity-45"}`}>
                <span className={`w-6 text-xs font-bold ${i < 8 ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{i + 1}º</span>
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

// ── Bracket (two-sided, with 3rd place) ──────────────────────
function BracketTab({ cup, onFixture }: { cup: CupState; onFixture: (f: Fixture) => void }) {
  const anyKo = cup.fixtures.some((f) => f.round >= 4);
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
        <span className={`truncate ${id === "USER" ? "text-[var(--accent)]" : ""}`}>
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
