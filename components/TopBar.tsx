"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/squad", label: "Seleção" },
  { href: "/cup", label: "Copa" },
];

export default function TopBar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(6,10,18,0.7)] border-b border-[var(--border)]">
      <div className="mx-auto max-w-5xl px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-xl tracking-wide">
          <span className="text-[var(--accent)]">FUT</span>BATTLE
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                pathname.startsWith(l.href)
                  ? "bg-[var(--accent)] text-[#04130B]"
                  : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
