import { sampleBeat, passBeat, carryBeat, shotBeat } from "../ball";
import { mulberry32 } from "@/lib/game/engine";
import type { Vec } from "../types";

const A: Vec = { x: 30, y: 40 };
const B: Vec = { x: 60, y: 55 };

describe("ball beats", () => {
  it("starts at `from` and ends at `to`", () => {
    const beat = passBeat(A, B, mulberry32(1));
    const s0 = sampleBeat(beat, 0);
    const s1 = sampleBeat(beat, 1);
    expect(s0.x).toBeCloseTo(A.x);
    expect(s0.y).toBeCloseTo(A.y);
    expect(s1.x).toBeCloseTo(B.x);
    expect(s1.y).toBeCloseTo(B.y);
    expect(s0.h).toBeCloseTo(0);
    expect(s1.h).toBeCloseTo(0);
  });

  it("moves continuously — no teleports between 60Hz samples", () => {
    for (const beat of [passBeat(A, B, mulberry32(2)), carryBeat(A, B), shotBeat(A, { x: 100, y: 50 }, "goal")]) {
      const steps = Math.max(1, Math.round(beat.durMs / (1000 / 60)));
      let prev = sampleBeat(beat, 0);
      for (let i = 1; i <= steps; i++) {
        const cur = sampleBeat(beat, i / steps);
        const d = Math.hypot(cur.x - prev.x, cur.y - prev.y);
        expect(d).toBeLessThanOrEqual(4.0);
        prev = cur;
      }
    }
  });

  it("pass duration scales with distance and is deterministic per seed", () => {
    const short = passBeat(A, { x: 35, y: 42 }, mulberry32(3));
    const long = passBeat(A, { x: 90, y: 60 }, mulberry32(3));
    expect(long.durMs).toBeGreaterThan(short.durMs);
    expect(passBeat(A, B, mulberry32(7))).toEqual(passBeat(A, B, mulberry32(7)));
  });

  it("shots are faster than carries", () => {
    const carry = carryBeat(A, B);
    const shot = shotBeat(A, B, "save");
    expect(shot.durMs).toBeLessThan(carry.durMs);
  });
});
