"use client";

import { useEffect } from "react";
import { sound } from "./SoundManager";

// Global [data-sound] delegation + PS2-style keyboard menu navigation.
//
//   <button data-sound>…</button>            → hover/focus: ui.move · press: ui.confirm
//   <button data-sound="cancel">…</button>   → press: ui.cancel
//   data-sound values: confirm | cancel/back | tab | error | dice | stamp | reveal
//
// Keyboard: arrows move focus between [data-sound] items (blip each),
// Enter/Space fires the press sound, Esc plays cancel + clicks a back item.

const CLICK_EVENT: Record<string, string> = {
  "": "ui.confirm",
  confirm: "ui.confirm",
  cancel: "ui.cancel",
  back: "ui.cancel",
  tab: "ui.tab",
  error: "ui.error",
  dice: "dado.roll",
  stamp: "ui.stamp",
  reveal: "card.reveal",
};

function pressEvent(el: Element): string {
  const v = el.getAttribute("data-sound") ?? "";
  return CLICK_EVENT[v] ?? "ui.confirm";
}

function vibrate(ms = 8) {
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    try { navigator.vibrate(ms); } catch { /* blocked by policy */ }
  }
}

function isTyping(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n) return false;
  const tag = n.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || n.isContentEditable;
}

const SELECTOR = '[data-sound]:not([disabled]):not([aria-disabled="true"])';

function visibleItems(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))
    .filter((el) => el.offsetParent !== null);
}

let bound = false;

/**
 * Bind the global UI-sound delegation once per document. The binding is
 * document-level and lives for the whole SPA session — it is intentionally
 * never torn down, so multiple <SoundProvider> mounts are harmless and a
 * page unmount never removes the shared listeners.
 */
export function initUiSound(): void {
  if (bound || typeof document === "undefined") return;
  bound = true;

  let lastPointerDown = 0;
  let lastHover: Element | null = null;

  const onPointerDown = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(SELECTOR);
    if (!el) return;
    lastPointerDown = Date.now();
    sound.play(pressEvent(el));
    vibrate(8);
  };

  const onPointerOver = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const el = (e.target as Element | null)?.closest?.(SELECTOR) ?? null;
    if (el === lastHover) return;
    lastHover = el;
    if (el) sound.play("ui.move");
  };

  // keyboard focus moves → blip (skip the focus that trails a mouse press)
  const onFocusIn = (e: FocusEvent) => {
    if (Date.now() - lastPointerDown < 160) return;
    const el = (e.target as Element | null)?.closest?.(SELECTOR);
    if (el) sound.play("ui.move");
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    const key = e.key;

    if (key === "ArrowDown" || key === "ArrowRight" || key === "ArrowUp" || key === "ArrowLeft") {
      const items = visibleItems();
      if (!items.length) return;
      const cur = document.activeElement as HTMLElement | null;
      const idx = cur ? items.indexOf(cur) : -1;
      const fwd = key === "ArrowDown" || key === "ArrowRight";
      let next = idx + (fwd ? 1 : -1);
      if (idx === -1) next = fwd ? 0 : items.length - 1;
      next = (next + items.length) % items.length;
      items[next].focus();          // focusin handler plays ui.move
      e.preventDefault();
      return;
    }

    if (key === "Enter" || key === " ") {
      const el = (e.target as Element | null)?.closest?.(SELECTOR);
      if (el) { sound.play(pressEvent(el)); vibrate(8); } // native click still runs the action
      return;
    }

    if (key === "Escape") {
      const back = document.querySelector<HTMLElement>('[data-sound="cancel"],[data-sound="back"]');
      sound.play("ui.cancel");
      back?.click();
    }
  };

  document.addEventListener("pointerdown", onPointerDown, { capture: true });
  document.addEventListener("pointerover", onPointerOver, { capture: true });
  document.addEventListener("focusin", onFocusIn, { capture: true });
  document.addEventListener("keydown", onKeyDown);
}

/** Mount the global UI-sound delegation (used by <SoundProvider>). */
export function useUISound() {
  useEffect(() => { initUiSound(); }, []);
}
