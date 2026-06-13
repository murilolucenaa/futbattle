import { groupsSemi1930 } from "../groupsSemi1930";
import { knockout1934, knockout1938 } from "../knockout";
import { drawCup, advanceCup, currentRound, simulateRound, buildAiTeam } from "@/lib/game/cup";
import { mulberry32 } from "@/lib/game/engine";
import { SQUADS } from "@/lib/data/squads";

const user = { name: "U", flag: "⭐", colors: ["#fff", "#000"] as [string, string] };

function runToEnd(editionId: string) {
  const cup = drawCup(user, 1234, editionId, "fiel");
  const builder = () => buildAiTeam(SQUADS[0], 99);
  let guard = 0;
  while (cup.phase !== "champion" && cup.phase !== "eliminated" && guard++ < 60) {
    const r = currentRound(cup);
    simulateRound(cup, r, builder);
    advanceCup(cup);
  }
  return cup;
}

describe("groupsSemi1930", () => {
  it("13 times, 4 grupos [4,3,3,3], jogos de grupo não-knockout", () => {
    const d = groupsSemi1930.build({ user, seed: 1, rand: mulberry32(1), editionId: "uruguai-1930" });
    expect(Object.keys(d.teams)).toHaveLength(13);
    const sizes = Object.values(d.groups).map((g) => g.length).sort();
    expect(sizes).toEqual([3, 3, 3, 4]);
    expect(d.fixtures.every((f) => !f.knockout)).toBe(true);
    expect(groupsSemi1930.lastRound).toBe(5);
    expect(groupsSemi1930.roundLabel(4)).toBe("Semifinal");
    expect(groupsSemi1930.roundLabel(5)).toBe("FINAL");
  });

  it("simula a copa inteira: grupos → semis → final, campeão definido", () => {
    const cup = runToEnd("uruguai-1930");
    expect(["champion", "eliminated"]).toContain(cup.phase);
    expect(cup.fixtures.filter((f) => f.round === 4)).toHaveLength(2); // 2 semis
    expect(cup.fixtures.filter((f) => f.round === 5)).toHaveLength(1); // 1 final
    expect(cup.fixtures.some((f) => f.round === 6)).toBe(false);       // sem 3º lugar
    expect(groupsSemi1930.champion(cup)).not.toBeNull();
    expect(groupsSemi1930.podium(cup)).toHaveLength(3);
  });
});

describe.each([
  ["italia-1934", knockout1934],
  ["franca-1938", knockout1938],
])("knockout %s", (editionId, engine) => {
  it("16 times, sem grupos, oitavas direto (knockout)", () => {
    const d = engine.build({ user, seed: 3, rand: mulberry32(3), editionId });
    expect(Object.keys(d.teams)).toHaveLength(16);
    expect(Object.keys(d.groups)).toHaveLength(0);
    expect(d.fixtures).toHaveLength(8);                 // 8 confrontos de oitavas
    expect(d.fixtures.every((f) => f.knockout)).toBe(true);
    expect(engine.roundLabel(1)).toBe("Oitavas de final");
    expect(engine.roundLabel(5)).toBe("FINAL");
  });

  it("simula a copa inteira até campeão, com disputa de 3º lugar", () => {
    const cup = runToEnd(editionId);
    expect(["champion", "eliminated"]).toContain(cup.phase);
    expect(cup.fixtures.filter((f) => f.round === 4)).toHaveLength(1); // 3º lugar
    expect(cup.fixtures.filter((f) => f.round === 5)).toHaveLength(1); // final
    expect(engine.champion(cup)).not.toBeNull();
    expect(engine.podium(cup)).toHaveLength(3);
  });
});
