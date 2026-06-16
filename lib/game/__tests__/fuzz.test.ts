// Fuzz/regressão: invariantes da engine em massa + todos os formatos de copa
// rodando até o fim. Determinístico (LCG fixo). Guarda contra regressões no
// motor durante mudanças rápidas.
import { createMatch, tick, aiMaybeAct } from "@/lib/game/engine";
import { buildAiTeam, drawCup, simulateRound, advanceCup, lastRound, currentRound, podium } from "@/lib/game/cup";
import { SQUAD_BY_ID, SQUADS } from "@/lib/data/squads";
import { EDITIONS } from "@/lib/data/editions";
import { fielAvailable } from "@/lib/game/formats/registry";

const ids = Object.keys(SQUAD_BY_ID);

function playFull(homeId: string, awayId: string, seed: number) {
  const state = createMatch(buildAiTeam(SQUAD_BY_ID[homeId]), buildAiTeam(SQUAD_BY_ID[awayId]), seed);
  let guard = 0;
  while (!state.finished && guard < 200) { tick(state); aiMaybeAct(state, "a"); guard++; }
  return state;
}

describe("engine fuzz", () => {
  it("invariantes em 400 partidas aleatórias", () => {
    const problems: string[] = [];
    let rng = 12345;
    const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 400; i++) {
      const h = ids[Math.floor(rnd() * ids.length)];
      const a = ids[Math.floor(rnd() * ids.length)];
      const seed = Math.floor(rnd() * 1e9);
      const s = playFull(h, a, seed);
      const tag = `${h} vs ${a} seed=${seed}`;
      if (!s.finished) problems.push(`${tag}: não terminou (guard)`);
      if (!(s.scoreH >= 0 && s.scoreA >= 0)) problems.push(`${tag}: placar negativo ${s.scoreH}-${s.scoreA}`);
      if (s.scoreH > 14 || s.scoreA > 14) problems.push(`${tag}: placar absurdo ${s.scoreH}-${s.scoreA}`);
      if (Number.isNaN(s.ballX) || Number.isNaN(s.ballY)) problems.push(`${tag}: ball NaN`);
      const poss = s.statsH.possession;
      if (poss < 0 || poss > 100) problems.push(`${tag}: posse fora ${poss}`);
      const totGoals = Object.values(s.playerStats).reduce((n, p) => n + (p.goals ?? 0), 0);
      if (totGoals !== s.scoreH + s.scoreA) problems.push(`${tag}: gols jogadores ${totGoals} != placar ${s.scoreH + s.scoreA}`);
    }
    if (problems.length) console.log("FUZZ PROBLEMS:\n" + problems.slice(0, 40).join("\n"));
    expect(problems).toEqual([]);
  });
});

describe("cup formats sweep — toda edição × modo completa e gera pódio", () => {
  const user = { name: "Seleção Teste", flag: "⭐", colors: ["#fff", "#000"] as [string, string] };
  const builder = () => buildAiTeam(SQUADS[0], 7);

  for (const ed of EDITIONS) {
    for (const mode of ["tradicional", "fiel"] as const) {
      if (mode === "fiel" && !fielAvailable(ed.id)) continue;
      it(`${ed.year} ${ed.id} [${mode}] completa sem crash`, () => {
        const cup = drawCup(user, 31337 + ed.year, ed.id, mode);
        for (let r = 1; r <= lastRound(cup); r++) {
          simulateRound(cup, r, builder);
          advanceCup(cup);
        }
        expect(currentRound(cup)).toBe(lastRound(cup) + 1);
        expect(podium(cup)).not.toBeNull();
      });
    }
  }
});
