import { STADIUMS, stadiumProfile, type StandShape } from "../stadiums";

const SHAPES: StandShape[] = ["oval", "circular", "rect", "rectNfl", "horseshoe", "dome"];

describe("stadiums dataset", () => {
  it("carrega todos os estádios das 23 edições (1930–2026)", () => {
    expect(STADIUMS.length).toBeGreaterThanOrEqual(220);
    const years = new Set(STADIUMS.map((s) => s.year));
    for (const y of [1930, 1934, 1938, 1950, 1970, 1994, 2014, 2026]) expect(years.has(y)).toBe(true);
  });

  it("todo perfil tem shape válido, ≥1 cor de cadeira em hex e cidade", () => {
    for (const s of STADIUMS) {
      expect(SHAPES).toContain(s.shape);
      expect(s.seats.length).toBeGreaterThanOrEqual(1);
      for (const hex of s.seats) expect(hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(s.city.length).toBeGreaterThan(1);
      expect(typeof s.track).toBe("boolean");
    }
  });

  it("classifica formatos icônicos corretamente", () => {
    expect(stadiumProfile("Estadio Monumental", 1978)?.shape).toBe("circular");
    expect(stadiumProfile("Lusail Iconic Stadium")?.shape).toBe("circular");
    expect(stadiumProfile("Olympiastadion", 2006)?.shape).toBe("horseshoe"); // Marathon Gate
    expect(stadiumProfile("Sapporo Dome")?.shape).toBe("dome");
    expect(stadiumProfile("MetLife Stadium")?.shape).toBe("rectNfl");
    expect(stadiumProfile("Estadio Centenario")?.shape).toBe("oval");
    expect(stadiumProfile("San Mamés", 1982)?.shape).toBe("rect");
  });

  it("track reflete fosso/pista; Maracanã 1950 tem fosso, San Siro não", () => {
    expect(stadiumProfile("Estádio do Maracanã", 1950)?.track).toBe(true);
    expect(stadiumProfile("Stadio San Siro", 1934)?.track).toBe(false);
  });

  it("desempata estádio reusado por ano (Azteca)", () => {
    expect(stadiumProfile("Estadio Azteca", 1970)?.capacity).toBe(107247);
    expect(stadiumProfile("Estadio Azteca", 1986)?.capacity).toBe(110574);
    expect(stadiumProfile("Estadio Azteca", 2026)?.capacity).toBe(87523);
  });

  it("retorna null para estádio inexistente", () => {
    expect(stadiumProfile("Estádio Fantasma XYZ")).toBeNull();
  });
});
