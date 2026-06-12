import { layoutCrowd, shimmerAlpha } from "../crowd";
import { mulberry32 } from "@/lib/game/engine";

describe("crowd layout", () => {
  it("puts each team's fans behind its own goal, mixed on the sides", () => {
    const dots = layoutCrowd(mulberry32(42), 600, 1);
    const left = dots.filter((d) => d.band === "left");
    const right = dots.filter((d) => d.band === "right");
    const sides = dots.filter((d) => d.band === "top" || d.band === "bottom");
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    expect(left.every((d) => d.side === "h")).toBe(true);
    expect(right.every((d) => d.side === "a")).toBe(true);
    const hShare = sides.filter((d) => d.side === "h").length / sides.length;
    expect(hShare).toBeGreaterThan(0.4);
    expect(hShare).toBeLessThan(0.6);
  });

  it("scales with density and is deterministic per seed", () => {
    const full = layoutCrowd(mulberry32(1), 600, 1);
    const half = layoutCrowd(mulberry32(1), 600, 0.5);
    expect(full.length).toBe(600);
    expect(half.length).toBeLessThan(400);
    expect(layoutCrowd(mulberry32(9), 600, 0.8)).toEqual(layoutCrowd(mulberry32(9), 600, 0.8));
  });

  it("shimmer stays within visible alpha bounds", () => {
    const [dot] = layoutCrowd(mulberry32(3), 10, 1);
    for (let t = 0; t < 10; t += 0.1) {
      const a = shimmerAlpha(dot, t);
      expect(a).toBeGreaterThanOrEqual(0.45);
      expect(a).toBeLessThanOrEqual(0.95);
    }
  });
});
