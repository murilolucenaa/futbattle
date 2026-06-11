// ============================================================
// FUTBATTLE — core domain types
// ============================================================

export type Position =
  | "GK" | "RB" | "CB" | "LB"
  | "DM" | "CM" | "AM"
  | "RW" | "LW" | "ST";

/** Brazilian-style short position codes (FIFA-like), used across the UI. */
export const POSITION_SHORT: Record<Position, string> = {
  GK: "GOL", RB: "LD", CB: "ZAG", LB: "LE",
  DM: "VOL", CM: "MC", AM: "MEI",
  RW: "PD", LW: "PE", ST: "CA",
};

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goleiro", RB: "Lateral direito", CB: "Zagueiro", LB: "Lateral esquerdo",
  DM: "Volante", CM: "Meio-campista", AM: "Meia-atacante",
  RW: "Ponta direita", LW: "Ponta esquerda", ST: "Centroavante",
};

export type Sector = "GK" | "DEF" | "MID" | "ATT";

export const POSITION_SECTOR: Record<Position, Sector> = {
  GK: "GK", RB: "DEF", CB: "DEF", LB: "DEF",
  DM: "MID", CM: "MID", AM: "MID",
  RW: "ATT", LW: "ATT", ST: "ATT",
};

// ── Data: historic squads ────────────────────────────────────
export interface PlayerDef {
  id: string;            // "<squadId>-<slug>"
  name: string;
  positions: Position[]; // first = natural position
  ovr: number;           // peak-based rating, 74–99
}

export interface SquadDef {
  id: string;            // "bra-1970"
  nation: string;        // "Brasil"
  year: number;
  flag: string;          // emoji
  colors: [string, string]; // [primary, secondary] hex — first kit
  kit2: [string, string];   // second kit (historically plausible)
  fame: number;          // 1–5, flavor/AI strength weight
  players: PlayerDef[];
}

// ── World Cup editions (host + stadiums + visual theme) ──────
export type PitchEra = "vintage" | "retro" | "classic" | "modern" | "ultra";

export interface Stadium {
  name: string;
  city: string;
  capacity: number; // approximate
}

export interface WCEdition {
  id: string;        // "brasil-2014"
  year: number;
  host: string;      // "Brasil" | "Coreia do Sul & Japão" …
  flag: string;
  era: PitchEra;     // drives pitch/stadium visual theme
  stadiums: Stadium[];
}

// ── Drafted card (player + provenance) ───────────────────────
export interface Card {
  player: PlayerDef;
  squadId: string;
  nation: string;
  year: number;
  flag: string;
}

// ── Formations & tactics ─────────────────────────────────────
export type FormationId =
  | "4-3-3" | "4-4-2" | "4-2-3-1" | "4-3-1-2" | "3-5-2" | "3-4-3" | "5-4-1"
  | "4-1-2-1-2" | "4-5-1" | "4-2-2-2" | "5-3-2" | "4-1-4-1" | "3-6-1";
export type Mentality = "defensivo" | "equilibrado" | "ofensivo";
export type GameStyle = "posse" | "contra-ataque" | "laterais" | "pressao" | "falso-9";

export interface Tactics {
  formation: FormationId;
  mentality: Mentality;
  style: GameStyle;
}

export interface FormationSlot {
  pos: Position;
  x: number; // 0–100, 0 = own goal line
  y: number; // 0–100, 0 = left touchline
}

// ── Team assembled for a match ───────────────────────────────
export interface MatchTeam {
  name: string;
  flag: string;
  colors: [string, string];
  tactics: Tactics;
  lineup: (Card | null)[]; // index-aligned with formation slots (11)
  bench: Card[];
  isUser: boolean;
}

// ── Live match engine ────────────────────────────────────────
export type MatchEventType =
  | "kickoff" | "goal" | "save" | "miss" | "post" | "card"
  | "sub" | "halftime" | "fulltime" | "chance" | "tactic"
  | "cooling" | "penalty-goal" | "penalty-miss";

export interface MatchEvent {
  min: number;
  type: MatchEventType;
  side: "h" | "a";
  text: string;
  playerId?: string;
  scoreH: number;
  scoreA: number;
}

export interface PlayerMatchStats {
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  saves: number;
  cards: number;
}

export interface TeamMatchStats {
  possession: number; // %
  shots: number;
  onTarget: number;
  corners: number;
  fouls: number;
}

export interface MatchResult {
  scoreH: number;
  scoreA: number;
  pensH?: number;
  pensA?: number;
  events: MatchEvent[];
  statsH: TeamMatchStats;
  statsA: TeamMatchStats;
  playerStats: Record<string, PlayerMatchStats>; // by card player id
  motmId: string | null;
}

// ── Cup structure (2026 format: 48 teams, 12 groups) ─────────
export interface CupTeamRef {
  squadId: string;  // "USER" for the player's team
  name: string;
  flag: string;
  colors: [string, string];
}

export interface Fixture {
  id: string;
  round: number;       // 1–3 groups · 4=R32 5=R16 6=QF 7=SF 8=3º lugar 9=Final
  group?: string;      // "A".."L" for group stage
  homeId: string;
  awayId: string;
  stadium?: string;    // from the chosen edition
  scoreH: number | null;
  scoreA: number | null;
  pensH?: number;
  pensA?: number;
  scorers?: { name: string; min: number; side: "h" | "a" }[];
}

export interface GroupRow {
  teamId: string;
  pts: number; p: number; w: number; d: number; l: number;
  gf: number; ga: number;
}

/** Cumulative tournament stats per player (leaders boards). */
export interface PlayerTotals {
  name: string;
  teamId: string;
  goals: number;
  assists: number;
  ratingSum: number;
  matches: number;
}

export type CupPhase =
  | "groups" | "r32" | "r16" | "qf" | "sf" | "third" | "final"
  | "champion" | "eliminated";

export interface CupState {
  teams: Record<string, CupTeamRef>;
  groups: Record<string, string[]>; // "A".."L" → 4 teamIds
  fixtures: Fixture[];
  phase: CupPhase;
  userGroup: string;
  seed: number;
  editionId: string;
  playerTotals: Record<string, PlayerTotals>;
}
