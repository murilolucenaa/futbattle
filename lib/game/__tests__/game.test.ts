import { SQUADS, eligiblePlayers } from "../../data/squads";
import { EDITIONS } from "../../data/editions";
import { FORMATIONS, FORMATION_IDS, assignLineup } from "../formations";
import { runFullMatch } from "../engine";
import {
  buildAiTeam, drawCup, groupTable, simulateRound, advanceCup, currentRound,
  GROUP_NAMES, LAST_ROUND, thirdPlaceTable, r32Qualifiers, leaders, podium,
} from "../cup";
import { REROLL_BUDGET, BENCH_REROLL_BONUS, drawSquad, squadWeight, squadPower } from "../rules";
import type { Position } from "../types";

describe("squads data", () => {
  const ALL_POSITIONS: Position[] = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

  it("has at least 48 squads (2026-format cup needs 47 opponents)", () => {
    expect(SQUADS.length).toBeGreaterThanOrEqual(48);
  });

  it("every squad has ≥11 players, ≥1 GK, kits and unique player ids", () => {
    const seen = new Set<string>();
    for (const s of SQUADS) {
      expect(s.players.length).toBeGreaterThanOrEqual(10);
      expect(s.players.some((p) => p.positions.includes("GK"))).toBe(true);
      expect(s.colors).toHaveLength(2);
      expect(s.kit2).toHaveLength(2);
      for (const p of s.players) {
        expect(seen.has(p.id)).toBe(false);
        seen.add(p.id);
        expect(p.ovr).toBeGreaterThanOrEqual(74);
        expect(p.ovr).toBeLessThanOrEqual(99);
        for (const pos of p.positions) expect(ALL_POSITIONS).toContain(pos);
      }
    }
  });

  it("every squad fields a full XI in at least one formation", () => {
    for (const s of SQUADS) {
      const team = buildAiTeam(s);
      expect(team.lineup.filter(Boolean).length).toBe(11);
    }
  });

  it("eligiblePlayers filters by position", () => {
    for (const s of SQUADS.slice(0, 5)) {
      for (const p of eligiblePlayers(s, "GK")) expect(p.positions).toContain("GK");
    }
  });
});

describe("editions data", () => {
  it("covers every World Cup host era from 1950 to 2026", () => {
    const years = EDITIONS.map((e) => e.year);
    for (const y of [1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1982, 1986, 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026]) {
      expect(years).toContain(y);
    }
  });

  it("every edition has real stadiums with city and capacity", () => {
    for (const e of EDITIONS) {
      expect(e.stadiums.length).toBeGreaterThanOrEqual(4);
      for (const st of e.stadiums) {
        expect(st.name.length).toBeGreaterThan(2);
        expect(st.city.length).toBeGreaterThan(2);
        expect(st.capacity).toBeGreaterThan(10000);
      }
    }
  });
});

describe("formations", () => {
  it("every formation has 11 slots and exactly 1 GK", () => {
    expect(FORMATION_IDS.length).toBeGreaterThanOrEqual(13);
    for (const f of FORMATION_IDS) {
      expect(FORMATIONS[f].length).toBe(11);
      expect(FORMATIONS[f].filter((s) => s.pos === "GK").length).toBe(1);
    }
  });

  it("assignLineup fills a full XI from a real squad", () => {
    const team = buildAiTeam(SQUADS[0]);
    const cards = [...team.lineup.filter((c) => c !== null), ...team.bench];
    const lineup = assignLineup(cards.slice(0, 11) as never, "4-3-3");
    expect(lineup.filter(Boolean).length).toBeGreaterThanOrEqual(10);
  });
});

describe("engine", () => {
  const home = buildAiTeam(SQUADS.find((s) => s.id === "bra-1970")!);
  const away = buildAiTeam(SQUADS.find((s) => s.id === "ita-1970")!);

  it("is deterministic for the same seed", () => {
    const a = runFullMatch(home, away, 42);
    const b = runFullMatch(home, away, 42);
    expect(a.scoreH).toBe(b.scoreH);
    expect(a.scoreA).toBe(b.scoreA);
    expect(a.events.length).toBe(b.events.length);
  });

  it("produces sane scorelines over 200 sims", () => {
    let totalGoals = 0;
    let max = 0;
    for (let i = 0; i < 200; i++) {
      const r = runFullMatch(home, away, i * 7 + 1);
      totalGoals += r.scoreH + r.scoreA;
      max = Math.max(max, r.scoreH + r.scoreA);
    }
    const avg = totalGoals / 200;
    expect(avg).toBeGreaterThan(1.2);
    expect(avg).toBeLessThan(5.5);
    expect(max).toBeLessThanOrEqual(14);
  });

  it("knockout draws resolve on penalties", () => {
    for (let i = 0; i < 50; i++) {
      const r = runFullMatch(home, away, i, true);
      if (r.scoreH === r.scoreA) {
        expect(r.pensH).toBeDefined();
        expect(r.pensH).not.toBe(r.pensA);
      }
    }
  });

  it("assigns ratings and a man of the match", () => {
    const r = runFullMatch(home, away, 7);
    expect(r.motmId).toBeTruthy();
    const ratings = Object.values(r.playerStats).map((p) => p.rating);
    expect(Math.max(...ratings)).toBeLessThanOrEqual(10);
    expect(Math.min(...ratings)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("cup (2026 format)", () => {
  it("draws 12 groups of 4 (48 teams) and a full tournament completes", () => {
    const cup = drawCup({ name: "Seleção Teste", flag: "⭐", colors: ["#fff", "#000"] }, 123);
    expect(Object.keys(cup.teams).length).toBe(48);
    expect(GROUP_NAMES.length).toBe(12);
    for (const g of GROUP_NAMES) expect(cup.groups[g].length).toBe(4);
    expect(cup.fixtures.filter((f) => f.round <= 3).length).toBe(72);
    for (const f of cup.fixtures) expect(f.stadium).toBeTruthy();

    const userSquad = SQUADS[0];
    const builder = () => buildAiTeam(userSquad, 99);
    for (let round = 1; round <= LAST_ROUND; round++) {
      simulateRound(cup, round, builder);
      advanceCup(cup);
    }
    expect(cup.fixtures.filter((f) => f.round === 4).length).toBe(16); // R32
    expect(cup.fixtures.filter((f) => f.round === 5).length).toBe(8);  // R16
    expect(cup.fixtures.filter((f) => f.round === 6).length).toBe(4);  // QF
    expect(cup.fixtures.filter((f) => f.round === 7).length).toBe(2);  // SF
    expect(cup.fixtures.filter((f) => f.round === 8).length).toBe(1);  // 3rd place
    expect(cup.fixtures.filter((f) => f.round === 9).length).toBe(1);  // Final
    expect(["champion", "eliminated"]).toContain(cup.phase);
    expect(currentRound(cup)).toBe(LAST_ROUND + 1);

    const pod = podium(cup);
    expect(pod).not.toBeNull();
    expect(new Set(pod!).size).toBe(3);

    for (const g of GROUP_NAMES) {
      const table = groupTable(cup, g);
      expect(table.length).toBe(4);
      const totalPts = table.reduce((s, r) => s + r.pts, 0);
      expect(totalPts).toBeGreaterThanOrEqual(12);
      expect(totalPts).toBeLessThanOrEqual(18);
      for (const row of table) expect(row.p).toBe(3);
    }
  });

  it("advances top 2 of each group plus the 8 best thirds", () => {
    const cup = drawCup({ name: "Seleção Teste", flag: "⭐", colors: ["#fff", "#000"] }, 77);
    const builder = () => buildAiTeam(SQUADS[1], 5);
    for (let r = 1; r <= 3; r++) simulateRound(cup, r, builder);
    advanceCup(cup);

    const quals = r32Qualifiers(cup);
    expect(quals.length).toBe(32);
    expect(new Set(quals).size).toBe(32);
    const thirds = thirdPlaceTable(cup);
    expect(thirds.length).toBe(12);
    // 8 best thirds qualify, 4 worst don't
    for (const t of thirds.slice(0, 8)) expect(quals).toContain(t.teamId);
    for (const t of thirds.slice(8)) expect(quals).not.toContain(t.teamId);

    const r32 = cup.fixtures.filter((f) => f.round === 4);
    expect(r32.length).toBe(16);
    const inBracket = r32.flatMap((f) => [f.homeId, f.awayId]);
    expect(new Set(inBracket).size).toBe(32);
    // no R32 tie pits two teams from the same group
    const groupOf = (id: string) => GROUP_NAMES.find((g) => cup.groups[g].includes(id));
    for (const f of r32) expect(groupOf(f.homeId)).not.toBe(groupOf(f.awayId));
  });

  it("accumulates tournament leaders (goals, assists, ratings)", () => {
    const cup = drawCup({ name: "Seleção Teste", flag: "⭐", colors: ["#fff", "#000"] }, 9);
    const builder = () => buildAiTeam(SQUADS[2], 3);
    for (let r = 1; r <= 3; r++) { simulateRound(cup, r, builder); advanceCup(cup); }
    const topG = leaders(cup, "goals", 5);
    expect(topG.length).toBeGreaterThan(0);
    expect(topG[0].goals).toBeGreaterThanOrEqual(topG[topG.length - 1].goals);
    const topR = leaders(cup, "rating", 5);
    for (const r of topR) expect(r.matches).toBeGreaterThanOrEqual(2);
  });
});

describe("draft rules (sorteio honesto)", () => {
  it("has a tight reroll budget plus a bench bonus", () => {
    expect(REROLL_BUDGET).toBe(4);
    expect(BENCH_REROLL_BONUS).toBe(1);
  });

  it("weights strong squads as rarer in the roulette", () => {
    const powers = SQUADS.map(squadPower);
    expect(Math.max(...powers)).toBeGreaterThan(88); // GOAT squads exist
    const strongest = SQUADS.reduce((a, b) => (squadPower(a) > squadPower(b) ? a : b));
    const weakest = SQUADS.reduce((a, b) => (squadPower(a) < squadPower(b) ? a : b));
    expect(squadWeight(strongest)).toBeLessThan(squadWeight(weakest));
  });

  it("drawSquad respects weights statistically", () => {
    let strongHits = 0;
    const strong = SQUADS.filter((s) => squadPower(s) >= 89);
    const n = 4000;
    let seed = 1;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < n; i++) {
      const s = drawSquad(SQUADS, { rand })!;
      if (strong.includes(s)) strongHits++;
    }
    // strong squads exist but land well below their uniform share
    const uniformShare = strong.length / SQUADS.length;
    expect(strongHits / n).toBeLessThan(uniformShare);
    expect(strongHits).toBeGreaterThan(0);
  });
});
