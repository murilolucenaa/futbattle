"use client";

import type { Position } from "@/lib/game/types";
import PosChip from "./PosChip";

interface PlayerCardProps {
  name: string;
  pos: Position;
  ovr: number;
  flag: string;       // nation flag emoji (allowed UI exception)
  code?: string;      // squad code, e.g. "BRA 70"
  selected?: boolean;
  onClick?: () => void;
}

function ovrColor(ovr: number): string {
  if (ovr >= 95) return "var(--trophy)";
  if (ovr >= 88) return "var(--accent)";
  if (ovr >= 82) return "#9BE564";
  return "var(--muted)";
}

/** Compact PES-roster row: chip, name, squad code, big tabular OVR. */
export default function PlayerCard({ name, pos, ovr, flag, code, selected, onClick }: PlayerCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-2 py-1 text-left transition-colors ${
        selected ? "bg-white/10" : "hover:bg-white/5"
      }`}
      style={{ boxShadow: selected ? "inset 3px 0 0 var(--accent)" : "inset 3px 0 0 transparent" }}
    >
      <PosChip pos={pos} size="sm" />
      <span className="text-base leading-none">{flag}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
      {code && <span className="type-label !text-[10px] shrink-0">{code}</span>}
      <span className="type-stat font-display w-8 text-right text-lg leading-none" style={{ color: ovrColor(ovr) }}>
        {ovr}
      </span>
    </button>
  );
}
