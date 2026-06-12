import { PHYS_DT, maxSpeedFor, makeAgent, anchorFor, stepAgents } from "../agents";
import type { AgentState } from "../types";
import type { FormationSlot } from "@/lib/game/types";

const slot = (pos: FormationSlot["pos"], x: number, y: number): FormationSlot => ({ pos, x, y });

function mk(id: string, side: "h" | "a", x: number, y: number, pos: FormationSlot["pos"] = "CM"): AgentState {
  const a = makeAgent(id, "Test", side, slot(pos, 50, 50), "#fff", pos === "GK", 7);
  a.x = x; a.y = y; a.anchorX = x; a.anchorY = y;
  return a;
}

describe("agents steering", () => {
  it("orders max speed ATT > MID > DEF > GK", () => {
    expect(maxSpeedFor("ST")).toBeGreaterThan(maxSpeedFor("CM"));
    expect(maxSpeedFor("CM")).toBeGreaterThan(maxSpeedFor("CB"));
    expect(maxSpeedFor("CB")).toBeGreaterThan(maxSpeedFor("GK"));
  });

  it("separates two agents stacked on the same point", () => {
    const a = mk("a", "h", 50, 50);
    const b = mk("b", "h", 50, 50.01);
    const agents = [a, b];
    for (let i = 0; i < 120; i++) stepAgents(agents, { x: 10, y: 10 }, null, i * PHYS_DT);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    expect(d).toBeGreaterThan(1.5);
  });

  it("never exceeds max speed", () => {
    const a = mk("a", "h", 10, 10, "ST");
    a.anchorX = 90; a.anchorY = 90;
    const agents = [a];
    for (let i = 0; i < 240; i++) {
      stepAgents(agents, { x: 90, y: 90 }, null, i * PHYS_DT);
      const v = Math.hypot(a.vx, a.vy);
      expect(v).toBeLessThanOrEqual(maxSpeedFor("ST") * 1.05);
    }
  });

  it("is deterministic for identical inputs", () => {
    const run = () => {
      const agents = [mk("a", "h", 30, 40), mk("b", "a", 60, 55), mk("c", "h", 31, 41)];
      for (let i = 0; i < 300; i++) stepAgents(agents, { x: 70, y: 50 }, null, i * PHYS_DT);
      return agents.map((x) => [x.x, x.y, x.vx, x.vy]).flat();
    };
    expect(run()).toEqual(run());
  });

  it("keeps the GK near its goal even when the ball is far", () => {
    const gk = mk("g", "h", 5, 50, "GK");
    const agents = [gk];
    for (let i = 0; i < 600; i++) stepAgents(agents, { x: 95, y: 50 }, null, i * PHYS_DT);
    expect(gk.x).toBeLessThanOrEqual(12);
  });

  it("anchors shift the whole side toward the ball zone", () => {
    const s = slot("CM", 50, 50);
    const deep = anchorFor(s, "h", 20, 50); // ball deep in own half → retreat
    const high = anchorFor(s, "h", 80, 50); // ball high → push
    expect(high.x).toBeGreaterThan(deep.x);
    // away side is mirrored
    const away = anchorFor(s, "a", 50, 50);
    expect(away.x).toBeGreaterThan(50);
  });
});
