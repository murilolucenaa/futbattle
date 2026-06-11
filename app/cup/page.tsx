"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import TopBar from "@/components/TopBar";
import { useCareer } from "@/lib/game/store";
import { GROUP_NAMES, ROUND_LABEL, currentRound, groupTable, userFixture } from "@/lib/game/cup";
import type { CupState, Fixture } from "@/lib/game/types";

function TeamLabel({ cup, id, bold }: { cup: CupState; id: string; bold?: boolean }) {
  const t = cup.teams[id];
  return (
    <span className={`inline-flex items-center gap-1.5 min-w-0 ${id === "USER" ? "text-[var(--accent)] font-bold" : bold ? "font-semibold" : ""}`}>
      <span className="shrink-0">{t.flag}</span>
      <span className="truncate">{t.name}</span>
    </span>
  );
}

function FixtureRow({ cup, f }: { cup: CupState; f: Fixture }) {
  const played = f.scoreH !== null;
  return (
    <div className="flex items-center gap-2 text-sm py-1.5">
      <div className="flex-1 text-right min-w-0"><TeamLabel cup={cup} id={f.homeId} /></div>
      <div className={`shrink-0 px-2.5 py-0.5 rounded-lg font-display text-base min-w-[3.5rem] text-center ${
        played ? "bg-[var(--surface-2)]" : "bg-[var(--surface)] text-[var(--muted)]"
      }`}>
        {played ? `${f.scoreH} – ${f.scoreA}` : "vs"}
        {f.pensH != null && <span className="text-[10px] block leading-none text-[var(--muted)]">pen {f.pensH}–{f.pensA}</span>}
      </div>
      <div className="flex-1 min-w-0"><TeamLabel cup={cup} id={f.awayId} /></div>
    </div>
  );
}

export default function CupPage() {
  const router = useRouter();
  const c = useCareer();
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<"groups" | "bracket">("groups");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    if (c.teamName === "") { router.replace("/"); return; }
    if (!c.cup) router.replace("/squad");
  }, [mounted, c.teamName, c.cup, router]);

  if (!mounted || !c.cup) return null;
  const cup = c.cup;
  const round = currentRound(cup);
  const next = round <= 7 ? userFixture(cup, round) : null;
  const isOver = cup.phase === "champion" || cup.phase === "eliminated";
  const eliminated = !next && !isOver && round <= 7;

  return (
    <>
      <TopBar />
      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-6">
        {/* Status hero */}
        {cup.phase === "champion" ? (
          <ChampionBanner name={c.teamName} />
        ) : next ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong p-6 mb-6 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-[rgba(0,255,135,0.08)] to-transparent pointer-events-none" />
            <div className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--gold)] mb-2">
              {ROUND_LABEL[round]} {next.group ? `· Grupo ${next.group}` : ""}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="font-display text-2xl sm:text-3xl flex items-center gap-3 min-w-0">
                <TeamLabel cup={cup} id={next.homeId} bold />
                <span className="text-[var(--muted)]">x</span>
                <TeamLabel cup={cup} id={next.awayId} bold />
              </div>
              <button onClick={() => router.push("/match")} className="btn-hero px-8 py-3.5 text-lg">
                ▶ Jogar partida
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="glass-strong p-6 mb-6 text-center">
            <div className="text-4xl mb-2">😔</div>
            <h2 className="font-display text-2xl mb-1">
              {eliminated || cup.phase === "eliminated" ? "Sua seleção foi eliminada" : "Copa encerrada"}
            </h2>
            <p className="text-sm text-[var(--muted)] mb-4">
              Acompanhe o desfecho da Copa abaixo — ou comece uma nova jornada.
            </p>
            <button onClick={() => router.push("/")} className="btn-hero px-6 py-3">🚀 Nova jornada</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {([["groups", "Fase de grupos"], ["bracket", "Mata-mata"]] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                tab === k ? "bg-[var(--accent)] text-[#04130B]" : "btn-ghost"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "groups" ? <GroupsTab cup={cup} /> : <BracketTab cup={cup} />}
      </main>
    </>
  );
}

function GroupsTab({ cup }: { cup: CupState }) {
  const ordered = [cup.userGroup, ...GROUP_NAMES.filter((g) => g !== cup.userGroup)];
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {ordered.map((g, gi) => {
        const table = groupTable(cup, g);
        const done = cup.fixtures.filter((f) => f.group === g).every((f) => f.scoreH !== null);
        return (
          <motion.div
            key={g}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: gi * 0.04 }}
            className={`glass p-4 ${g === cup.userGroup ? "ring-1 ring-[rgba(0,255,135,0.35)]" : ""}`}
          >
            <h3 className="font-display text-lg mb-2 flex items-center justify-between">
              <span>Grupo {g} {g === cup.userGroup && <span className="text-[var(--accent)] text-sm">· seu grupo</span>}</span>
            </h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                  <th className="text-left font-semibold pb-1">Seleção</th>
                  <th className="w-7 font-semibold">P</th>
                  <th className="w-7 font-semibold">J</th>
                  <th className="w-7 font-semibold">V</th>
                  <th className="w-7 font-semibold">SG</th>
                  <th className="w-7 font-semibold">GP</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, i) => (
                  <tr
                    key={row.teamId}
                    className={`border-t border-[var(--border)] ${
                      i < 2 && done ? "bg-[rgba(0,255,135,0.06)]" : ""
                    }`}
                  >
                    <td className="py-1.5 pr-2">
                      <span className="flex items-center gap-1.5 max-w-[9.5rem] overflow-hidden">
                        <span className={`w-4 shrink-0 text-[10px] font-bold ${i < 2 ? "text-[var(--accent)]" : "text-[var(--muted)]"}`}>{i + 1}º</span>
                        <TeamLabel cup={cup} id={row.teamId} />
                      </span>
                    </td>
                    <td className="text-center font-bold">{row.pts}</td>
                    <td className="text-center text-[var(--muted)]">{row.p}</td>
                    <td className="text-center text-[var(--muted)]">{row.w}</td>
                    <td className="text-center text-[var(--muted)]">{row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga}</td>
                    <td className="text-center text-[var(--muted)]">{row.gf}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="mt-2">
              <summary className="text-xs text-[var(--muted)] cursor-pointer hover:text-white">Jogos do grupo</summary>
              <div className="mt-1 divide-y divide-[var(--border)]">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="py-1">
                    {cup.fixtures.filter((f) => f.group === g && f.round === r).map((f) => (
                      <FixtureRow key={f.id} cup={cup} f={f} />
                    ))}
                  </div>
                ))}
              </div>
            </details>
          </motion.div>
        );
      })}
    </div>
  );
}

function BracketTab({ cup }: { cup: CupState }) {
  const rounds = [4, 5, 6, 7];
  const anyKo = cup.fixtures.some((f) => f.round >= 4);
  if (!anyKo) {
    return (
      <div className="glass p-10 text-center text-[var(--muted)]">
        O chaveamento aparece quando a fase de grupos terminar.
      </div>
    );
  }
  return (
    <div className="grid md:grid-cols-4 gap-4 items-start">
      {rounds.map((r) => {
        const fs = cup.fixtures.filter((f) => f.round === r);
        return (
          <div key={r}>
            <h3 className={`font-display mb-2 text-center ${r === 7 ? "text-[var(--gold)] text-xl" : "text-base"}`}>
              {ROUND_LABEL[r]}
            </h3>
            <div className="space-y-3">
              {fs.length === 0 && (
                <div className="glass p-3 text-center text-xs text-[var(--muted)]">a definir</div>
              )}
              {fs.map((f) => {
                const isUser = f.homeId === "USER" || f.awayId === "USER";
                return (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`glass p-3 ${isUser ? "ring-1 ring-[rgba(0,255,135,0.4)]" : ""}`}
                  >
                    <FixtureRow cup={cup} f={f} />
                    {f.scorers && f.scorers.length > 0 && (
                      <div className="text-[10px] text-[var(--muted)] mt-1 text-center">
                        ⚽ {f.scorers.map((s) => `${s.name} ${s.min}'`).join(" · ")}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChampionBanner({ name }: { name: string }) {
  const pieces = Array.from({ length: 36 });
  return (
    <div className="glass-strong p-10 mb-6 text-center relative overflow-hidden">
      {pieces.map((_, i) => (
        <span
          key={i}
          className="confetti absolute text-base pointer-events-none"
          style={{
            left: `${(i * 137) % 100}%`,
            animationDuration: `${2.4 + (i % 5) * 0.7}s`,
            animationDelay: `${(i % 8) * 0.35}s`,
            animationIterationCount: "infinite",
          }}
          aria-hidden
        >
          {["🎉", "✨", "🟡", "🟢", "⭐"][i % 5]}
        </span>
      ))}
      <div className="text-6xl mb-3">🏆</div>
      <h2 className="font-display text-4xl mb-2 text-[var(--gold)]">CAMPEÃO DO MUNDO!</h2>
      <p className="text-lg">
        <span className="text-[var(--accent)] font-bold">{name}</span> conquistou a Copa FUTBATTLE. Lenda eterna.
      </p>
    </div>
  );
}
