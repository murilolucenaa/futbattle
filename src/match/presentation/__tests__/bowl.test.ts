import {
  bowlSpec, innerRadius, outerRadius, ringPoint, bandTheta,
  outerSilhouette, type Band, type Rect,
} from "../bowl";
import type { StandShape } from "@/lib/data/stadiums";

const PITCH: Rect = { x: 40, y: 60, w: 720, h: 400 };
const BANDX = 40, BANDY = 60;
const ALL: StandShape[] = ["rect", "rectNfl", "oval", "circular", "horseshoe", "dome"];

const thetas = Array.from({ length: 24 }, (_, i) => (i / 24) * Math.PI * 2);

describe("bowl geometry", () => {
  it("keeps the outer edge at or beyond the pitch edge for every shape/angle", () => {
    for (const shape of ALL) {
      const s = bowlSpec(PITCH, BANDX, BANDY, shape);
      for (const t of thetas) {
        expect(outerRadius(s, t)).toBeGreaterThanOrEqual(innerRadius(s, t) - 1e-6);
        expect(Number.isFinite(outerRadius(s, t))).toBe(true);
      }
    }
  });

  it("touches the band envelope along the axes (no overflow, full fill)", () => {
    const s = bowlSpec(PITCH, BANDX, BANDY, "oval");
    expect(outerRadius(s, 0)).toBeCloseTo(s.rx, 5);          // toward away goal
    expect(outerRadius(s, Math.PI / 2)).toBeCloseTo(s.ry, 5); // toward the touchline
  });

  it("morphs from boxy to round: a rectangle reaches further into its corner than an ellipse", () => {
    const rect = bowlSpec(PITCH, BANDX, BANDY, "rect");
    const circ = bowlSpec(PITCH, BANDX, BANDY, "circular");
    const corner = Math.atan2(-rect.ry, rect.rx); // toward the top-right corner
    expect(outerRadius(rect, corner)).toBeGreaterThan(outerRadius(circ, corner));
  });

  it("collapses the away end of a horseshoe to leave the gate open", () => {
    const s = bowlSpec(PITCH, BANDX, BANDY, "horseshoe");
    // at the open end the ring has ~no depth; the home end is a full bowl
    expect(outerRadius(s, 0) - innerRadius(s, 0)).toBeLessThan(1);
    expect(outerRadius(s, Math.PI) - innerRadius(s, Math.PI)).toBeGreaterThan(BANDX * 0.5);
  });

  it("bands sweep the arc facing their side of the pitch", () => {
    const s = bowlSpec(PITCH, BANDX, BANDY, "oval");
    const dir = (band: Band) => {
      const p = ringPoint(s, bandTheta(s, band, 0.5), 0.5);
      return { dx: p.x - s.cx, dy: p.y - s.cy };
    };
    expect(dir("top").dy).toBeLessThan(0);     // up
    expect(dir("bottom").dy).toBeGreaterThan(0); // down
    expect(dir("left").dx).toBeLessThan(0);    // toward the home goal
    expect(dir("right").dx).toBeGreaterThan(0); // toward the away goal
  });

  it("produces a closed silhouette polygon with finite points", () => {
    for (const shape of ALL) {
      const s = bowlSpec(PITCH, BANDX, BANDY, shape);
      const poly = outerSilhouette(s, 64);
      expect(poly.length).toBe(64 * 2);
      expect(poly.every((v) => Number.isFinite(v))).toBe(true);
    }
  });
});
