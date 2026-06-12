import { g32 } from "../g32";
import { mulberry32 } from "@/lib/game/engine";

const base = {
  user: { name: "User", flag: "⭐", colors: ["#fff", "#000"] as [string, string] },
  seed: 3, editionId: "franca-1998",
};

describe("g32", () => {
  it("32 times, 8 grupos, 48 jogos de grupo", () => {
    const d = g32.build({ ...base, rand: mulberry32(3) });
    expect(Object.keys(d.teams)).toHaveLength(32);
    expect(Object.keys(d.groups)).toHaveLength(8);
    expect(d.fixtures).toHaveLength(48);
    expect(d.fixtures.every((f) => !f.knockout)).toBe(true);
  });
  it("lastRound 8, round 4 = Oitavas", () => {
    expect(g32.lastRound).toBe(8);
    expect(g32.roundLabel(4)).toBe("Oitavas de final");
    expect(g32.roundLabel(8)).toBe("FINAL");
  });
});
