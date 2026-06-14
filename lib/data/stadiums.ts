// ============================================================
// FUTBATTLE — perfis de estádio (1930–2026), derivados do dataset
// de pesquisa em stadiums.json. Cada perfil vira layout visual na
// partida (formato da arquibancada, fosso/pista, cor das cadeiras,
// cobertura). Dados crus ficam no .json; aqui só tipos + derivação.
// ============================================================

import RAW from "./stadiums.json";

/** Silhueta da arquibancada usada pelo render. */
export type StandShape = "oval" | "circular" | "rect" | "rectNfl" | "horseshoe" | "dome";

/** Cobertura derivada do formato + detalhe. */
export type Roof = "none" | "partial" | "tent" | "full";

export interface StadiumProfile {
  name: string;
  city: string;
  country: string;
  year: number;
  capacity: number;
  shape: StandShape;
  track: boolean;          // fosso/pista separando torcida do gramado
  roof: Roof;
  seats: string[];         // cores das cadeiras em hex (≥1)
  seatNames: string[];     // nomes originais em pt-BR
  shapeText: string;       // formato_geometrico original
  note: string;            // detalhe_arquitetonico
}

interface RawStadium {
  nome: string;
  cidade_pais: string;
  ano_copa: number;
  capacidade: number;
  formato_geometrico: string;
  cores_arquibancada: string[];
  distancia_campo: boolean;
  detalhe_arquitetonico: string;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

/** Classifica o formato_geometrico textual numa silhueta de render. */
function classifyShape(formato: string): StandShape {
  const f = norm(formato);
  if (f.includes("ferradura")) return "horseshoe";
  if (f.includes("cupula") || f.includes("coberto") || f.includes("fechado sob")) return "dome";
  if (f.includes("futebol americano") || f.includes("modular de poligonos")) return "rectNfl";
  if (f.includes("circular")) return "circular";
  if (f.includes("oval") || f.includes("elipt") || f.includes("elipse")
    || f.includes("bacia") || f.includes("coliseu") || f.includes("prato")) return "oval";
  return "rect";
}

function classifyRoof(formato: string, note: string): Roof {
  const f = norm(formato), n = norm(note);
  if (f.includes("cupula") || f.includes("fechado sob") || n.includes("oclusao total")) return "full";
  if (n.includes("tenda")) return "tent";
  if (n.includes("teto") || n.includes("cobertura") || n.includes("membrana")
    || n.includes("telhado") || n.includes("anel de cobertura")) return "partial";
  return "none";
}

// Nome de cor pt-BR (do dataset) → hex de cadeira.
const SEAT_HEX: Record<string, string> = {
  "cinza": "#8a8a8a", "azul": "#2a5bd7", "branco": "#f1f0e9", "marrom": "#6b4a2b",
  "marrom claro": "#a9805a", "madeira": "#b5895a", "cinza escuro": "#595959", "areia": "#d8c79a",
  "vermelho": "#c23a2b", "vermelho terra": "#a0432f", "roxo": "#6a2c91", "cinza claro": "#bdbdbd",
  "azul claro": "#6db3e8", "marrom escuro": "#4a3320", "cinza envelhecido": "#7d756a",
  "azul escuro": "#1b2d5b", "azul ceruleo": "#2a7fd4", "verde": "#2e8b3d", "preto": "#202020",
  "amarelo": "#f2c500", "cinza concreto": "#9a958c", "azul vibrante": "#1a6fd4", "azul ceu": "#6fc0ee",
  "laranja": "#ef7d1a", "vermelho profundo": "#8e1c24", "azul royal": "#1245a8", "vinho": "#7a1f2b",
  "amarelo ouro": "#e8b800", "azul profundo": "#14245b", "verde oliva": "#6b7335",
  "cinza asfalto": "#4a4d4f", "caqui": "#b3a06a", "vermelho brilhante": "#e02d1f",
  "azul grena": "#5a2342", "violeta": "#7d3cae", "ocre": "#c08a3e", "cinza azulado": "#8593a3",
  "rosa": "#e87bb0", "tom pastel": "#d9c9b0", "cinza palido": "#c8c8c0", "vermelho cardinal": "#8c1515",
  "prata": "#c0c4c8", "azul marinho": "#16233f", "sangue e ouro": "#b21f2d",
  "verde acinzentado": "#7f9182", "cinza metalico": "#a6acb2", "azul oceanico brilhante": "#1c8ad0",
  "laranja telha": "#c5622d", "amarelo mostarda": "#d6a516", "cinza grafite": "#4d4d52",
  "dourado": "#d4af37", "bordo": "#6e1423", "bege": "#d6c6a8", "cinza escuro asfalto": "#44474a",
  "verde pinho": "#1f4a2e", "verde musgo": "#5a6b3a", "verde neon": "#4fe04f", "verde-agua": "#2bbfa3",
};

function seatHex(name: string): string {
  return SEAT_HEX[norm(name)] ?? "#8a8a8a";
}

function splitCityCountry(s: string): { city: string; country: string } {
  const i = s.lastIndexOf(",");
  if (i < 0) return { city: s.trim(), country: "" };
  return { city: s.slice(0, i).trim(), country: s.slice(i + 1).trim() };
}

export const STADIUMS: StadiumProfile[] = (RAW as RawStadium[]).map((r) => {
  const { city, country } = splitCityCountry(r.cidade_pais);
  return {
    name: r.nome,
    city, country,
    year: r.ano_copa,
    capacity: r.capacidade,
    shape: classifyShape(r.formato_geometrico),
    track: r.distancia_campo,
    roof: classifyRoof(r.formato_geometrico, r.detalhe_arquitetonico),
    seats: r.cores_arquibancada.map(seatHex),
    seatNames: r.cores_arquibancada,
    shapeText: r.formato_geometrico,
    note: r.detalhe_arquitetonico,
  };
});

const BY_NORM_NAME = new Map<string, StadiumProfile[]>();
for (const s of STADIUMS) {
  const k = norm(s.name);
  (BY_NORM_NAME.get(k) ?? BY_NORM_NAME.set(k, []).get(k)!).push(s);
}

/**
 * Resolve o perfil de um estádio por nome (e ano opcional para desempatar
 * estádios reusados em Copas diferentes, ex.: Azteca 1970/1986/2026).
 * Tenta match exato normalizado, depois "contém". Retorna null se não achar.
 */
export function stadiumProfile(name: string, year?: number): StadiumProfile | null {
  if (!name) return null;
  const key = norm(name);
  let hits = BY_NORM_NAME.get(key);
  if (!hits) {
    hits = STADIUMS.filter((s) => { const n = norm(s.name); return n.includes(key) || key.includes(n); });
  }
  if (hits.length === 0) return null;
  if (year != null) {
    const exact = hits.find((s) => s.year === year);
    if (exact) return exact;
    return [...hits].sort((a, b) => Math.abs(a.year - year) - Math.abs(b.year - year))[0];
  }
  return hits[0];
}
