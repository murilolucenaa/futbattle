import type { GameStyle, Mentality, Tactics } from "./types";

export interface TacticMods {
  att: number;        // attack strength multiplier
  def: number;        // defense strength multiplier
  shotRate: number;   // chance-creation multiplier
  possession: number; // additive % shift in midfield duel
  counter: number;    // shot-quality bonus when opponent dominates the ball
  wingWeight: number; // scorer/assist weight multiplier for RW/LW
  staminaDrain: number;
  falseNine: boolean;
}

export const MENTALITY_LABEL: Record<Mentality, string> = {
  defensivo: "Defensivo",
  equilibrado: "Equilibrado",
  ofensivo: "Ofensivo",
};

export const STYLE_LABEL: Record<GameStyle, string> = {
  posse: "Toque de bola",
  "contra-ataque": "Contra-ataque",
  laterais: "Ataque pelas laterais",
  pressao: "Pressão alta",
  "falso-9": "Falso 9",
};

export const STYLE_DESC: Record<GameStyle, string> = {
  posse: "Mais posse e controle, menos chances diretas.",
  "contra-ataque": "Cede a bola e mata o jogo em transições letais.",
  laterais: "Cruzamentos e amplitude — pontas decidem.",
  pressao: "Sufoca a saída adversária. Gasta gás.",
  "falso-9": "Centroavante flutua e o meio domina o jogo.",
};

export function tacticMods(t: Tactics): TacticMods {
  const m: TacticMods = {
    att: 1, def: 1, shotRate: 1, possession: 0,
    counter: 0, wingWeight: 1, staminaDrain: 1, falseNine: false,
  };
  if (t.mentality === "defensivo")  { m.att *= 0.85; m.def *= 1.16; m.shotRate *= 0.82; m.possession -= 4; }
  if (t.mentality === "ofensivo")   { m.att *= 1.16; m.def *= 0.87; m.shotRate *= 1.20; m.possession += 4; }
  switch (t.style) {
    case "posse":          m.possession += 8; m.shotRate *= 0.92; m.def *= 1.04; break;
    case "contra-ataque":  m.possession -= 8; m.counter = 0.18; m.def *= 1.06; break;
    case "laterais":       m.wingWeight = 1.9; m.shotRate *= 1.06; break;
    case "pressao":        m.possession += 6; m.shotRate *= 1.08; m.staminaDrain = 1.3; m.def *= 0.97; break;
    case "falso-9":        m.falseNine = true; m.possession += 5; m.att *= 1.03; break;
  }
  return m;
}
