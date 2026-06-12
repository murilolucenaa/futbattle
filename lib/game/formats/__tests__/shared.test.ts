import { roundRobin, pickOpponents } from "../shared";
import { mulberry32 } from "@/lib/game/engine";
import { SQUADS } from "@/lib/data/squads";

describe("roundRobin", () => {
  it("4 times → 3 rodadas de 2 jogos, todos contra todos", () => {
    const rounds = roundRobin(["a", "b", "c", "d"]);
    expect(rounds).toHaveLength(3);
    rounds.forEach((r) => expect(r).toHaveLength(2));
    const pairs = rounds.flat().map(([x, y]) => [x, y].sort().join("-")).sort();
    expect(new Set(pairs).size).toBe(6); // C(4,2)
  });

  it("3 times → 3 rodadas com 1 jogo (1 bye por rodada)", () => {
    const rounds = roundRobin(["a", "b", "c"]);
    expect(rounds).toHaveLength(3);
    expect(rounds.flat()).toHaveLength(3); // C(3,2)
  });

  it("2 times → 1 rodada, 1 jogo", () => {
    const rounds = roundRobin(["a", "b"]);
    expect(rounds.flat()).toEqual([["a", "b"]]);
  });
});

describe("pickOpponents", () => {
  it("retorna n squads distintos e é determinístico por seed", () => {
    const a = pickOpponents(SQUADS, mulberry32(5), 12);
    const b = pickOpponents(SQUADS, mulberry32(5), 12);
    expect(a).toHaveLength(12);
    expect(new Set(a.map((s) => s.id)).size).toBe(12);
    expect(a.map((s) => s.id)).toEqual(b.map((s) => s.id));
  });
});
