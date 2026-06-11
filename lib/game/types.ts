// ============================================================
// FUTBATTLE — core domain types
// ============================================================

export type Position =
  | "GK" | "RB" | "CB" | "LB"
  | "DM" | "CM" | "AM"
  | "RW" | "LW" | "ST";

export const POSITION_LABEL: Record<Position, string> = {
  GK: "Goleiro", RB: "Lateral Dir.", CB: "Zagueiro", LB: "Lateral Esq.",
  DM: "Volante", CM: "Meio-campo", AM: "Meia-atacante",
  RW: "Ponta Dir.", LW: "Ponta Esq.", ST: "Centroavante",
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
  colors: [string, string]; // [primary, secondary] hex — shirt colors
  fame: number;          // 1–5, weight in roulette and AI strength flavor
  players: PlayerDef[];
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
export type FormationId = "4-3-3" | "4-4-2" | "4-2-3-1" | "4-3-1-2" | "3-5-2" | "3-4-3" | "5-4-1";
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
  | "sub" | "halftime" | "fulltime" | "chance" | "tactic" | "penalty-goal" | "penalty-miss";

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

// ── Cup structure ────────────────────────────────────────────
export interface CupTeamRef {
  squadId: string;  // "USER" for the player's team
  name: string;
  flag: string;
  colors: [string, string];
}

export interface Fixture {
  id: string;
  round: number;       // group: 1–3 · knockout: 4=R16 5=QF 6=SF 7=Final
  group?: string;      // "A".."H" for group stage
  homeId: string;
  awayId: string;
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

export type CupPhase = "groups" | "r16" | "qf" | "sf" | "final" | "champion" | "eliminated";

export interface CupState {
  teams: Record<string, CupTeamRef>;
  groups: Record<string, string[]>; // "A" → 4 teamIds
  fixtures: Fixture[];
  phase: CupPhase;
  userGroup: string;
  seed: number;
}
