import { finalGroup1950 } from "../finalGroup1950";
import { drawCup, advanceCup, currentRound, simulateRound, buildAiTeam } from "@/lib/game/cup";
import { mulberry32 } from "@/lib/game/engine";
import { SQUADS } from "@/lib/data/squads";

describe("finalGroup1950", () => {
  it("13 times, 4 grupos [4,4,3,2], fixtures de grupo não-knockout", () => {
    const d = finalGroup1950.build({
      user: { name: "U", flag: "⭐", colors: ["#fff", "#000"] }, seed: 1,
      rand: mulberry32(1), editionId: "brasil-1950",
    });
    expect(Object.keys(d.teams)).toHaveLength(13);
    expect(Object.keys(d.groups)).toHaveLength(4);
    const sizes = Object.values(d.groups).map((g) => g.length).sort();
    expect(sizes).toEqual([2, 3, 4, 4]);
    expect(d.fixtures.every((f) => !f.knockout)).toBe(true);
    expect(finalGroup1950.lastRound).toBe(6);
  });

  it("simula a copa inteira: cria grupo final e termina em campeão sem final clássica", () => {
    const cup = drawCup({ name: "U", flag: "⭐", colors: ["#fff", "#000"] }, 4242, "brasil-1950", "fiel");
    const builder = () => buildAiTeam(SQUADS[0], 99);
    let guard = 0;
    while (cup.phase !== "champion" && cup.phase !== "eliminated" && guard++ < 40) {
      const r = currentRound(cup);
      if (r <= finalGroup1950.lastRound) simulateRound(cup, r, builder);
      advanceCup(cup);
    }
    expect(["champion", "eliminated"]).toContain(cup.phase);
    expect(cup.fixtures.some((f) => f.round >= 4)).toBe(true);   // grupo final existe
    expect(cup.fixtures.some((f) => f.group === "FINAL")).toBe(true);
    expect(finalGroup1950.champion(cup)).not.toBeNull();
  });
});
