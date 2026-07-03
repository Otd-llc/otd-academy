"use client";

// Within-card island jump-nav (guide-pacing plan, Task 4). Two surfaces, one
// state: a fixed vertical rail on desktop (variant B3c — the Saira number sits
// on a gold hairline spine, boxed when active) and a sticky progress meter on
// mobile (variant M3 — "ISLAND 04 / 8 · title" + a segmented gold bar). Both
// picked from the Task 3 sandbox.
//
// Scroll-spy is an IntersectionObserver whose root is collapsed to the viewport
// midline (`rootMargin: -50% 0 -50%`), so it fires exactly when an anchor
// crosses the middle of the screen; the callback recomputes active + visited
// from live rects. `active` = the last anchor above the midline. v2 ticks: an
// island is `visited` once a LATER island has crossed the midline (you scrolled
// through it), or once the document bottom is reached (the end sentinel). The
// visited set + last active anchor persist to localStorage[storageKey] as
// { anchorId, visited, ts } — the same record Task 6's resume layer reads.

import { useCallback, useEffect, useRef, useState } from "react";
import type { Island } from "@/lib/guide-islands";
import { readResume, writeResume } from "@/lib/resume-position";

type NodeState = "active" | "visited" | "unvisited";

const numColor = (st: NodeState) =>
  st === "active" ? "var(--color-gold-light)" : st === "visited" ? "var(--color-command-gold)" : "var(--color-gray-3)";

function SairaNum({ children, st, size }: { children: React.ReactNode; st: NodeState; size: number }) {
  return (
    <span className="font-numeral" style={{ fontSize: size, fontWeight: 800, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color: numColor(st), transition: "color .3s" }}>
      {children}
    </span>
  );
}

export function IslandRail({ islands, storageKey }: { islands: Island[]; storageKey: string }) {
  const [activeIdx, setActiveIdx] = useState(-1);
  const [visited, setVisited] = useState<Set<string>>(() => new Set());
  const reduceRef = useRef(false);

  // Restore persisted visited ticks + note reduced-motion (client only).
  useEffect(() => {
    const rec = readResume(storageKey);
    if (rec) setVisited(new Set(rec.visited));
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, [storageKey]);

  // Scroll-spy: recompute active + visited from live rects, throttled by rAF.
  useEffect(() => {
    const els = islands.map((i) => document.getElementById(i.anchorId));
    let raf = 0;
    const compute = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      let act = -1;
      els.forEach((el, idx) => {
        if (el && el.getBoundingClientRect().top <= mid) act = idx;
      });
      if (act < 0) act = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      setActiveIdx(act);
      setVisited((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (let j = 0; j < act; j++) {
          const id = islands[j]!.anchorId;
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        if (atBottom && islands[act]) {
          const id = islands[act]!.anchorId;
          if (!next.has(id)) {
            next.add(id);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    const io = new IntersectionObserver(schedule, { rootMargin: "-50% 0px -50% 0px", threshold: 0 });
    els.forEach((el) => el && io.observe(el));
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    compute();
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [islands]);

  // Persist whenever active/visited actually change — but NOT the top-of-page
  // state on load (activeIdx < 1), so a fresh visit doesn't clobber the saved
  // resume position before the ResumePill can offer it.
  useEffect(() => {
    if (activeIdx < 1) return;
    const anchorId = islands[activeIdx]?.anchorId;
    if (!anchorId) return;
    writeResume(storageKey, { anchorId, visited: [...visited], ts: Date.now() });
  }, [activeIdx, visited, islands, storageKey]);

  const go = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceRef.current ? "auto" : "smooth", block: "start" });
    history.pushState(null, "", `#${anchorId}`);
  }, []);

  if (islands.length === 0) return null;

  const stateOf = (idx: number): NodeState => (idx === activeIdx ? "active" : visited.has(islands[idx]!.anchorId) ? "visited" : "unvisited");

  // desktop rail geometry (mirrors the sandbox B3c winner)
  const rowH = 26;
  const gap = 16;
  const pad = 4;
  const center = (i: number) => pad + i * (rowH + gap) + rowH / 2;
  const n = islands.length;

  const cur = islands[Math.max(0, activeIdx)]!;

  return (
    <>
      {/* ── Desktop: fixed vertical rail (B3c). Hidden below xl. ── */}
      <nav aria-label="Jump to section" className="hidden xl:block fixed right-5 top-1/2 z-30 -translate-y-1/2">
        <div style={{ position: "relative", paddingBlock: pad }}>
          <div style={{ position: "absolute", left: "50%", top: center(0), height: center(n - 1) - center(0), width: 1, transform: "translateX(-0.5px)", background: "color-mix(in srgb, var(--color-command-gold) 40%, transparent)" }} />
          <div style={{ display: "flex", flexDirection: "column", gap, alignItems: "center" }}>
            {islands.map((is, idx) => {
              const st = stateOf(idx);
              return (
                <button
                  key={is.anchorId}
                  onClick={() => go(is.anchorId)}
                  title={`${is.num} · ${is.title}`}
                  aria-current={st === "active" ? "true" : undefined}
                  className="focus-visible:outline-none"
                  style={{ position: "relative", height: rowH, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                >
                  <span style={{ background: "var(--color-deep-space)", padding: st === "active" ? "2px 6px" : "1px 6px", border: st === "active" ? "1px solid var(--color-command-gold)" : "1px solid transparent", borderRadius: 3, transition: "all .3s" }}>
                    <SairaNum st={st} size={18}>{is.num}</SairaNum>
                  </span>
                  {st === "active" ? (
                    <span className="font-mono" style={{ position: "absolute", right: "100%", marginRight: 8, whiteSpace: "nowrap", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-gold-light)" }}>
                      {is.title}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* ── Mobile: sticky progress meter (M3). Hidden at xl+. ── */}
      {/* nav carries ONLY the responsive gate (xl:hidden) + sticky chrome; the
          flex layout lives on an inner div so an inline `display` can't defeat
          the `xl:hidden` class (inline style beats a Tailwind class). */}
      <nav
        aria-label="Section progress"
        className="xl:hidden sticky top-0 z-30"
        style={{ background: "var(--color-deep-space)", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", padding: "9px 2px" }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>ISLAND</span>
            <SairaNum st="active" size={20}>{cur.num}</SairaNum>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--color-gray-3)" }}>/ {n}</span>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.title}</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {islands.map((is, idx) => {
              const done = idx <= Math.max(0, activeIdx);
              return (
                <button
                  key={is.anchorId}
                  onClick={() => go(is.anchorId)}
                  title={`${is.num} · ${is.title}`}
                  aria-label={`${is.num} ${is.title}`}
                  className="focus-visible:outline-none"
                  style={{ flex: 1, height: 5, borderRadius: 2, border: "none", cursor: "pointer", padding: 0, background: done ? "var(--color-command-gold)" : "color-mix(in srgb, var(--color-panel-border) 70%, transparent)", transition: "background .3s" }}
                />
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
