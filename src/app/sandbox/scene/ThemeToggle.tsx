"use client";

// Sandbox-only theme flip. The light overrides live at `:root[data-theme]`, so
// the attribute has to land on the document element; a wrapper cannot scope it.
import { useEffect, useState } from "react";

export function ThemeToggle({ note }: { note: string }) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center gap-4 border-b border-panel-border/60 bg-deep-space/95 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-command-gold">
        ▸ The beta set, live
      </span>
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="glass-button px-3 py-1 font-mono text-[10px] uppercase tracking-[0.14em]"
      >
        Theme · {theme}
      </button>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{note}</span>
    </div>
  );
}
