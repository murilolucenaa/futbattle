import { g16 } from "../g16";
import { mulberry32 } from "@/lib/game/engine";

const base = { user: { name: "U", flag: "⭐", colors: ["#fff","#000"] as [string,string] }, seed: 2, editionId: "mexico-1970" };

describe("g16", () => {
  it("16 times, 4 grupos, 24 jogos de grupo", () => {
    const d = g16.build({ ...base, rand: mulberry32(2) });
    expect(Object.keys(d.teams)).toHaveLength(16);
    expect(Object.keys(d.groups)).toHaveLength(4);
    expect(d.fixtures).toHaveLength(24);
  });
  it("lastRound 7, round 4 = Quartas, sem oitavas", () => {
    expect(g16.lastRound).toBe(7);
    expect(g16.roundLabel(4)).toBe("Quartas de final");
    expect(g16.roundLabel(7)).toBe("FINAL");
  });
});
