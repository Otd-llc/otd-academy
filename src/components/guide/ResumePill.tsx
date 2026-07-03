"use client";

// Resume pill (guide-pacing plan, Task 6). A floating control (chrome, so a
// navy-dark widget is on-brand) that offers to jump back to where the learner
// left off. NO auto-scroll — it only appears when a resume record exists, the
// URL has no hash (they didn't deep-link in), and the saved anchor isn't the
// first island. One click scrolls there; dismiss hides it for the session and
// stores nothing. SSR-safe: nothing renders until the mount effect resolves.

import { useEffect, useRef, useState } from "react";
import type { Island } from "@/lib/guide-islands";
import { readResume } from "@/lib/resume-position";

export function ResumePill({ islands, storageKey }: { islands: Island[]; storageKey: string }) {
  const [target, setTarget] = useState<Island | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (window.location.hash) return; // deep-linked in — respect their target
    const rec = readResume(storageKey);
    if (!rec) return;
    if (!rec.anchorId || rec.anchorId === islands[0]?.anchorId) return; // nothing to resume
    const island = islands.find((i) => i.anchorId === rec.anchorId);
    if (island) setTarget(island);
  }, [islands, storageKey]);

  if (!target || dismissed) return null;

  const go = () => {
    const el = document.getElementById(target.anchorId);
    if (el) {
      el.scrollIntoView({ behavior: reduceRef.current ? "auto" : "smooth", block: "start" });
      history.pushState(null, "", `#${target.anchorId}`);
    }
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          background: "var(--color-navy-dark)",
          border: "1px solid color-mix(in srgb, var(--color-command-gold) 55%, transparent)",
          borderRadius: 6,
          boxShadow: "var(--elev-raise)",
          paddingLeft: 4,
        }}
      >
        <button onClick={go} className="focus-visible:outline-none" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", padding: "8px 10px" }}>
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>Resume</span>
          <span className="font-numeral" style={{ fontSize: 16, fontWeight: 800, fontVariantNumeric: "tabular-nums", color: "var(--color-gold-light)", lineHeight: 1 }}>{target.num}</span>
          <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text)", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{target.title}</span>
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Dismiss resume" className="focus-visible:outline-none" style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 11px", color: "var(--color-muted)", fontSize: 15, lineHeight: 1 }}>
          ×
        </button>
      </div>
    </div>
  );
}
