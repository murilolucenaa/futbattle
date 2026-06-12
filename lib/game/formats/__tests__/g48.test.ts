import { g48 } from "../g48";
import { mulberry32 } from "@/lib/game/engine";

const ctx = {
  user: { name: "Brasil do Murilo", flag: "⭐", colors: ["#FFDC00", "#009739"] as [string, string] },
  seed: 99, rand: mulberry32(99), editionId: "america-do-norte-2026",
};

describe("g48", () => {
  it("48 times, 12 grupos de 4, 72 jogos de grupo (não-knockout)", () => {
    const d = g48.build({ ...ctx, rand: mulberry32(99) });
    expect(Object.keys(d.teams)).toHaveLength(48);
    expect(Object.keys(d.groups)).toHaveLength(12);
    Object.values(d.groups).forEach((g) => expect(g).toHaveLength(4));
    expect(d.fixtures).toHaveLength(72);
    expect(d.fixtures.every((f) => f.knockout === false)).toBe(true);
    expect(d.userGroup).toMatch(/^[A-L]$/);
  });

  it("determinístico: mesmo seed ⇒ mesmos grupos", () => {
    const a = g48.build({ ...ctx, rand: mulberry32(7) });
    const b = g48.build({ ...ctx, rand: mulberry32(7) });
    expect(a.groups).toEqual(b.groups);
  });

  it("lastRound 9, labels coerentes", () => {
    expect(g48.lastRound).toBe(9);
    expect(g48.roundLabel(4)).toBe("16 avos de final");
    expect(g48.roundLabel(9)).toBe("FINAL");
  });
});
