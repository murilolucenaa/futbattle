// Auto-pick goalkeeper kit colors: high contrast vs BOTH team kits and
// vs the other keeper. Deterministic — same kits, same answer.

/** Manhattan RGB distance between two #RRGGBB colors. */
export function colorDist(a: string, b: string): number {
  const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  const [r1, g1, b1] = hex(a), [r2, g2, b2] = hex(b);
  return Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2);
}

const GK_PALETTE = [
  "#FFD400", // amarelo
  "#00E5FF", // ciano
  "#FF3DA6", // rosa
  "#FF7A00", // laranja
  "#B6FF00", // verde-limão
  "#9D4DFF", // roxo
  "#FFFFFF",
  "#111111",
];

function bestPick(avoid: string[], exclude: Set<string>): string {
  let best = GK_PALETTE[0];
  let bestScore = -1;
  for (const cand of GK_PALETTE) {
    if (exclude.has(cand)) continue;
    const score = Math.min(...avoid.map((c) => colorDist(cand, c)));
    if (score > bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

/** [homeGk, awayGk] — each far from all 4 kit colors and from each other. */
export function pickGkColors(
  homeKit: [string, string], awayKit: [string, string]
): [string, string] {
  const kits = [homeKit[0], homeKit[1], awayKit[0], awayKit[1]];
  const gkH = bestPick(kits, new Set());
  const gkA = bestPick([...kits, gkH], new Set([gkH]));
  return [gkH, gkA];
}
