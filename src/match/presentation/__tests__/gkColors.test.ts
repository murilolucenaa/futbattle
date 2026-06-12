import { pickGkColors, colorDist } from "../gkColors";

describe("pickGkColors", () => {
  const bra: [string, string] = ["#FFDC00", "#009C3B"];
  const arg: [string, string] = ["#75AADB", "#FFFFFF"];

  it("returns two colors far from both kits and from each other", () => {
    const [gkH, gkA] = pickGkColors(bra, arg);
    const kits = [bra[0], bra[1], arg[0], arg[1]];
    for (const gk of [gkH, gkA]) {
      for (const kit of kits) {
        expect(colorDist(gk, kit)).toBeGreaterThanOrEqual(150);
      }
    }
    expect(colorDist(gkH, gkA)).toBeGreaterThanOrEqual(150);
  });

  it("is deterministic", () => {
    expect(pickGkColors(bra, arg)).toEqual(pickGkColors(bra, arg));
  });

  it("handles kits that collide with most of the palette", () => {
    // yellow + cyan kits eat the brightest palette entries
    const a: [string, string] = ["#FFD400", "#00E5FF"];
    const b: [string, string] = ["#FF3DA6", "#B6FF00"];
    const [gkH, gkA] = pickGkColors(a, b);
    expect(gkH).not.toEqual(gkA);
    expect(colorDist(gkH, gkA)).toBeGreaterThan(0);
  });
});
