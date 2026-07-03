"use client";

// TEMP sandbox (guide-pacing Task 3) — deleted before the PR (Task 9).
// ROUND 2: variations of variant B (dot + gold hairline spine), Josh's lean,
// plus the fixed mobile chip strips (E/F). Josh picks one desktop B* + one
// mobile in the browser, in BOTH themes.
//
// Everything is TOKEN-ONLY (var(--color-*) / token utilities). The theme flip
// drives the REAL shipped :root[data-theme="light"] override in globals.css, so
// any accidental hardcoded colour visibly fails to flip.

import { useEffect, useState } from "react";

const ISLANDS = [
  { num: "01", title: "The regulator" },
  { num: "02", title: "Decoupling & the module" },
  { num: "03", title: "The USB-C connector" },
  { num: "04", title: "USB power & protection" },
  { num: "05", title: "The USB data pair" },
  { num: "06", title: "Indicator LEDs" },
  { num: "07", title: "The boot & reset straps" },
  { num: "08", title: "Break out every pin" },
];

type IState = "visited" | "active" | "unvisited";
const stateOf = (i1: number, active: number): IState =>
  i1 < active ? "visited" : i1 === active ? "active" : "unvisited";

// Demo mode mapping for variant F, matching the guide ModeBandBlock palette.
const modeOf = (i1: number): "orient" | "do" | "check" =>
  i1 <= 2 ? "orient" : i1 >= 7 ? "check" : "do";
const MODE_TOKEN: Record<string, string> = {
  orient: "var(--color-signal-blue)",
  do: "var(--color-command-gold)",
  check: "var(--color-status-green)",
};

type DotMode = "baseline" | "progress" | "numbered" | "labelled";

/* ── VARIANT B family — dot + gold hairline spine ───────────────── */
function DotRail({ active, onPick, mode }: { active: number; onPick: (n: number) => void; mode: DotMode }) {
  const n = ISLANDS.length;
  const rowH = 22;
  const gap = 14;
  const pad = 6;
  const center = (i0: number) => pad + i0 * (rowH + gap) + rowH / 2;
  const first = center(0);
  const last = center(n - 1);
  const act = center(active - 1);
  const progress = mode === "progress";
  return (
    <div style={{ position: "relative", paddingBlock: pad, minWidth: 168 }}>
      {/* faint full spine */}
      <div
        style={{
          position: "absolute",
          left: 11,
          top: first,
          height: last - first,
          width: 1,
          background: progress
            ? "color-mix(in srgb, var(--color-panel-border) 85%, transparent)"
            : "color-mix(in srgb, var(--color-command-gold) 40%, transparent)",
        }}
      />
      {/* progress gold spine (B2 only): line fills up to the active node */}
      {progress ? (
        <div style={{ position: "absolute", left: 11, top: first, height: Math.max(0, act - first), width: 1, background: "var(--color-command-gold)", transition: "height .3s" }} />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {ISLANDS.map((is, i) => {
          const st = stateOf(i + 1, active);
          const dotW = st === "active" ? 13 : 9;
          const dotBg = st === "active" ? "var(--color-command-gold)" : st === "visited" ? "var(--color-gold-dim)" : "var(--color-deep-space)";
          const txtColor = st === "active" ? "var(--color-gold-light)" : st === "visited" ? "var(--color-command-gold)" : "var(--color-muted)";
          const label = mode === "numbered" ? is.num : mode === "labelled" ? `${is.num} · ${is.title}` : st === "active" ? is.title : "";
          return (
            <button
              key={is.num}
              onClick={() => onPick(i + 1)}
              title={`${is.num} · ${is.title}`}
              className="focus-visible:outline-none"
              style={{ height: rowH, display: "grid", gridTemplateColumns: "22px 1fr", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
            >
              <span style={{ display: "flex", justifyContent: "center" }}>
                <span
                  style={{
                    width: dotW,
                    height: dotW,
                    borderRadius: 999,
                    background: dotBg,
                    transition: "all .3s",
                    border: st === "unvisited" ? "1px solid color-mix(in srgb, var(--color-panel-border) 85%, transparent)" : undefined,
                    boxShadow: st === "active" ? "0 0 0 3px color-mix(in srgb, var(--color-command-gold) 28%, transparent)" : undefined,
                  }}
                />
              </span>
              <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: txtColor, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color .3s" }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── VARIANT E / F — mobile chip strip ──────────────────────────── */
function ChipStrip({ active, onPick, modeTint }: { active: number; onPick: (n: number) => void; modeTint: boolean }) {
  return (
    <div style={{ flex: "0 0 auto", display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", background: "var(--color-deep-space)" }}>
      {ISLANDS.map((is, i) => {
        const st = stateOf(i + 1, active);
        const tint = MODE_TOKEN[modeOf(i + 1)];
        const color = st === "active" ? "var(--color-gold-light)" : st === "visited" ? "var(--color-command-gold)" : "var(--color-gray-3)";
        return (
          <button
            key={is.num}
            onClick={() => onPick(i + 1)}
            className="font-mono focus-visible:outline-none"
            style={{
              flex: "0 0 auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 10px",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color,
              cursor: "pointer",
              borderRadius: 3,
              border: st === "active" ? "1px solid var(--color-command-gold)" : "1px solid color-mix(in srgb, var(--color-panel-border) 55%, transparent)",
              borderLeft: modeTint ? `2px solid ${tint}` : undefined,
              background: st === "active" ? "color-mix(in srgb, var(--color-command-gold) 8%, transparent)" : "none",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ fontWeight: 700 }}>{is.num}</span>
            <span style={{ letterSpacing: "0.04em" }}>{is.title}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ── mock block column the rail rides beside ────────────────────── */
function MockBlocks() {
  return (
    <div className="space-y-5">
      {ISLANDS.map((is) => (
        <div key={is.num}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ {is.num}</div>
          <div className="font-display" style={{ fontSize: 20, letterSpacing: "0.03em", color: "var(--color-title)", marginTop: 2 }}>{is.title}</div>
          <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text)", marginTop: 6 }}>
            Placeholder body copy so the rail has a column to scroll against. The regulator drops five volts to three-three; the module never sees USB voltage directly.
          </p>
          <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-muted)", marginTop: 6 }}>
            A second muted line to give the section some height.
          </p>
        </div>
      ))}
    </div>
  );
}

function Caption({ id, text }: { id: string; text: string }) {
  return (
    <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-command-gold)", marginBottom: 10 }}>
      ▸ {id} · <span style={{ color: "var(--color-muted)" }}>{text}</span>
    </div>
  );
}

/* desktop variant cell: mock column (scrolls) with the rail stuck to the right */
function DesktopCell({ id, text, rail }: { id: string; text: string; rail: React.ReactNode }) {
  return (
    <div>
      <Caption id={id} text={text} />
      <div style={{ border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, height: 520, overflow: "hidden" }}>
        <div style={{ height: "100%", overflowY: "auto", display: "flex", gap: 16, padding: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <MockBlocks />
          </div>
          <div style={{ flex: "0 0 auto", alignSelf: "flex-start", position: "sticky", top: 0 }}>{rail}</div>
        </div>
      </div>
    </div>
  );
}

/* mobile variant cell: phone-width frame, chip strip under a fake header.
   Frame is a fixed-height flex column: header + strip are fixed, only the
   block region scrolls (flex:1 + minHeight:0 — the piece that was missing). */
function MobileCell({ id, text, modeTint }: { id: string; text: string; modeTint: boolean }) {
  const [active, setActive] = useState(4);
  return (
    <div>
      <Caption id={id} text={text} />
      <div style={{ width: 390, maxWidth: "100%", border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, height: 560, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 auto", padding: "12px 14px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)" }}>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>SCHEMATIC · L1.01</div>
          <div className="font-display" style={{ fontSize: 22, color: "var(--color-title)", letterSpacing: "0.03em" }}>Draw the WROOM breakout</div>
        </div>
        <ChipStrip active={active} onPick={setActive} modeTint={modeTint} />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
          <MockBlocks />
        </div>
      </div>
    </div>
  );
}

export default function IslandRailSandbox() {
  const [theme, setTheme] = useState<string>("dark");
  const [active, setActive] = useState(4); // shared across B1–B4 for like-for-like

  useEffect(() => {
    const original = document.documentElement.dataset.theme ?? "dark";
    setTheme(original);
    return () => {
      document.documentElement.dataset.theme = original;
    };
  }, []);

  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setTheme(next);
  };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 80px", color: "var(--color-text)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--color-command-gold) 40%, transparent)", paddingBottom: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · GUIDE PACING · ROUND 2</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6, WebkitTextStroke: "0.4px var(--color-title)" }}>Island rail — B variations</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 660 }}>
            Four takes on the dot + gold-hairline spine (B). Click any node to move the active state (shared across all four). Mobile chip strips fixed below. Flip the theme to judge BOTH — pick one desktop B* + one mobile.
          </p>
        </div>
        <button
          onClick={flip}
          className="font-mono focus-visible:outline-none"
          style={{ flex: "0 0 auto", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 6, padding: "9px 14px", background: "none", cursor: "pointer" }}
        >
          Theme · {theme === "dark" ? "◑ dark" : "◐ light"} → flip
        </button>
      </div>

      <section style={{ marginTop: 32 }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Desktop · dot + hairline spine (hidden below xl in the real build)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 28 }}>
          <DesktopCell id="B1" text="baseline · icon-only, title on active" rail={<DotRail active={active} onPick={setActive} mode="baseline" />} />
          <DesktopCell id="B2" text="progress spine · gold line fills to active" rail={<DotRail active={active} onPick={setActive} mode="progress" />} />
          <DesktopCell id="B3" text="numbered · mono 01–08 always shown" rail={<DotRail active={active} onPick={setActive} mode="numbered" />} />
          <DesktopCell id="B4" text="labelled · every island titled (mini-nav)" rail={<DotRail active={active} onPick={setActive} mode="labelled" />} />
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Mobile chip strips (sticky under header; shown below xl only)</div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <MobileCell id="E" text="chip strip · horizontal scroll" modeTint={false} />
          <MobileCell id="F" text="chip strip · mode-colour accent (orient/do/check)" modeTint={true} />
        </div>
      </section>
    </main>
  );
}
