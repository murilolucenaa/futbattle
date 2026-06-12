import { g24 } from "../g24";
import { mulberry32 } from "@/lib/game/engine";

const base = { user: { name: "U", flag: "⭐", colors: ["#fff","#000"] as [string,string] }, seed: 8, editionId: "mexico-1986" };

describe("g24", () => {
  it("24 times, 6 grupos, 36 jogos de grupo", () => {
    const d = g24.build({ ...base, rand: mulberry32(8) });
    expect(Object.keys(d.teams)).toHaveLength(24);
    expect(Object.keys(d.groups)).toHaveLength(6);
    expect(d.fixtures).toHaveLength(36);
  });
  it("lastRound 8, round 4 = Oitavas", () => {
    expect(g24.lastRound).toBe(8);
    expect(g24.roundLabel(4)).toBe("Oitavas de final");
  });
});
