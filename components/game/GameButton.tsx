"use client";

import { sound } from "@/src/audio/SoundManager";

interface GameButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "grass" | "gold" | "steel";
  /** Skip the built-in confirm sound (e.g. when the action plays its own). */
  silent?: boolean;
}

/** Physical-feel button: hover blips, press sinks 4px, release snaps. */
export default function GameButton({ variant = "grass", silent, className = "", onClick, onMouseEnter, children, ...rest }: GameButtonProps) {
  const variantClass = variant === "gold" ? "btn-game--gold" : variant === "steel" ? "btn-game--steel" : "";
  return (
    <button
      type="button"
      className={`btn-game px-5 py-2.5 text-lg ${variantClass} ${className}`}
      onMouseEnter={(e) => { sound.play("ui.move"); onMouseEnter?.(e); }}
      onClick={(e) => { if (!silent) sound.play("ui.confirm"); onClick?.(e); }}
      {...rest}
    >
      {children}
    </button>
  );
}
