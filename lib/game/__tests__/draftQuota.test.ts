import { POSITION_ROLE, ROLE_SHORT } from "@/lib/game/types";
import { ROLE_QUOTA, SQUAD_SIZE, roleOf, rolesOfCard } from "@/lib/game/draftQuota";
import type { Card, Position } from "@/lib/game/types";

const ALL_POS: Position[] = ["GK", "RB", "CB", "LB", "DM", "CM", "AM", "RW", "LW", "ST"];

describe("POSITION_ROLE", () => {
  it("mapeia todo Position pra exatamente 1 Role", () => {
    for (const p of ALL_POS) expect(POSITION_ROLE[p]).toBeDefined();
    expect(POSITION_ROLE.GK).toBe("GOL");
    expect(POSITION_ROLE.CB).toBe("ZAG");
    expect(POSITION_ROLE.RB).toBe("LAT");
    expect(POSITION_ROLE.LB).toBe("LAT");
    expect(POSITION_ROLE.DM).toBe("VOL");
    expect(POSITION_ROLE.CM).toBe("MEI");
    expect(POSITION_ROLE.AM).toBe("MEI");
    expect(POSITION_ROLE.RW).toBe("ATA");
    expect(POSITION_ROLE.LW).toBe("ATA");
    expect(POSITION_ROLE.ST).toBe("ATA");
  });
  it("ROLE_SHORT cobre as 6 funções", () => {
    expect(Object.keys(ROLE_SHORT).sort()).toEqual(["ATA", "GOL", "LAT", "MEI", "VOL", "ZAG"]);
  });
});

describe("ROLE_QUOTA", () => {
  it("soma 19 (13 titulares + 6 reservas)", () => {
    expect(SQUAD_SIZE).toBe(19);
    expect(ROLE_QUOTA.length).toBe(19);
    expect(ROLE_QUOTA.filter((q) => !q.reserve).length).toBe(13);
    expect(ROLE_QUOTA.filter((q) => q.reserve).length).toBe(6);
  });
  it("toda função tem exatamente 1 reserva", () => {
    for (const role of ["GOL", "ZAG", "LAT", "VOL", "MEI", "ATA"] as const) {
      expect(ROLE_QUOTA.filter((q) => q.role === role && q.reserve).length).toBe(1);
    }
  });
  it("roleOf / rolesOfCard", () => {
    expect(roleOf("ST")).toBe("ATA");
    const lateral = { player: { positions: ["RB", "LB"] } } as Card;
    expect(rolesOfCard(lateral)).toEqual(["LAT"]);
    const versatil = { player: { positions: ["DM", "CM"] } } as Card;
    expect(rolesOfCard(versatil).sort()).toEqual(["MEI", "VOL"]);
  });
});
