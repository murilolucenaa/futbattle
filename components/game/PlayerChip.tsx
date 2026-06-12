"use client";

import type { Position } from "@/lib/game/types";
import { POSITION_SHORT } from "@/lib/game/types";

type EmptyState = "open" | "dim" | "idle";

interface FilledProps {
  variant: "filled";
  name: string;          // already shortened by the caller
  ovr: number;
  flag: string;
  pos: Position;
  /** Fade out while the user is picking another player. */
  dim?: boolean;
  onClick?: () => void;
}

interface EmptyProps {
  variant: "empty";
  pos: Position;
  /** open = lima calling · dim = incompatible grey · idle = dashed. */
  state: EmptyState;
  onClick?: () => void;
}

type PlayerChipProps = FilledProps | EmptyProps;

/**
 * A pitch slot in the "Fliperama da Copa" ink style. Filled chips stamp in
 * (scale 1.2 → 1 via `.stamp-in`); the caller plays the reveal sound on the
 * placement event so re-fits (formation change) don't replay it.
 */
export default function PlayerChip(props: PlayerChipProps) {
  if (props.variant === "filled") {
    const { name, ovr, flag, pos, dim, onClick } = props;
    return (
      <button
        type="button"
        onClick={onClick}
        className={`stamp-in flex flex-col items-center ${dim ? "opacity-35 grayscale" : ""}`}
      >
        <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[var(--ink)] bg-[var(--paper)] font-display text-base text-[var(--ink)] shadow-[2px_3px_0_var(--ink)]">
          {ovr}
          <span className="absolute -right-2 -top-2 text-sm drop-shadow">{flag}</span>
        </span>
        <span className="mt-1 max-w-[88px] truncate rounded-full bg-[var(--ink)] px-2 py-0.5 font-arc text-[10px] font-extrabold uppercase text-[var(--paper)]">
          {name}
        </span>
        <span className="mt-px font-arc text-[8px] font-extrabold uppercase text-white/75">{POSITION_SHORT[pos]}</span>
      </button>
    );
  }

  const { pos, state, onClick } = props;
  const open = state === "open";
  const dim = state === "dim";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center ${open ? "" : dim ? "cursor-not-allowed" : "cursor-default"}`}
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full border-[3px] font-display text-xl transition-colors ${
          open
            ? "slot-call border-[var(--ink)] bg-[var(--lima)] text-[var(--ink)]"
            : dim
              ? "border-[var(--ink)] bg-[#A8AC9C] text-[var(--ink)] opacity-45"
              : "border-dashed border-white/55 bg-black/25 text-white/65"
        }`}
      >
        +
      </span>
      <span
        className={`mt-1 rounded-full px-2 py-0.5 font-arc text-[10px] font-extrabold uppercase ${
          open ? "border-2 border-[var(--ink)] bg-[var(--lima)] text-[var(--ink)]" : "bg-black/55 text-white/85"
        }`}
      >
        {POSITION_SHORT[pos]}
      </span>
    </button>
  );
}
