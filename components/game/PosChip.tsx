"use client";

import type { Position } from "@/lib/game/types";
import { POSITION_SHORT, POSITION_SECTOR, type Sector } from "@/lib/game/types";

// PES-style position chip: GK gold, DEF blue, MID green, ATT red.
const SECTOR_BG: Record<Sector, string> = {
  GK: "var(--pos-gk)",
  DEF: "var(--pos-def)",
  MID: "var(--pos-mid)",
  ATT: "var(--pos-att)",
};

const SECTOR_FG: Record<Sector, string> = {
  GK: "#1A1206",
  DEF: "#06101F",
  MID: "#04130B",
  ATT: "#FFF5F5",
};

export function sectorColor(pos: Position): string {
  return SECTOR_BG[POSITION_SECTOR[pos]];
}

export default function PosChip({ pos, size = "md" }: { pos: Position; size?: "sm" | "md" }) {
  const sector = POSITION_SECTOR[pos];
  return (
    <span
      className={`inline-flex items-center justify-center font-display tv-slab ${
        size === "sm" ? "w-9 text-[10px] py-[1px]" : "w-11 text-xs py-[2px]"
      }`}
      style={{
        background: SECTOR_BG[sector],
        color: SECTOR_FG[sector],
        textShadow: "0 1px 0 rgba(255,255,255,0.15)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(0,0,0,0.4)",
      }}
    >
      {POSITION_SHORT[pos]}
    </span>
  );
}
