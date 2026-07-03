"use client";

// TEMP sandbox (guide-pacing Task 3) — deleted before the PR (Task 9).
// Renders 6 island-rail variants against a mock 8-island block column so Josh
// picks a desktop + a mobile winner in the browser, seeing BOTH themes.
//
// Everything here is TOKEN-ONLY (var(--color-*) / token utilities). That is the
// point of the theme toggle: it flips <html data-theme> through the REAL shipped
// :root[data-theme="light"] override in globals.css, so any accidental hardcoded
// colour visibly fails to flip — the theming law enforcing itself in the sandbox.

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

// Demo mode mapping for variant F (orient / do / check), matching the guide's
// ModeBandBlock palette (GuideBlocks.tsx MODE map) via tokens so it flips.
const modeOf = (i1: number): "orient" | "do" | "check" =>
  i1 <= 2 ? "orient" : i1 >= 7 ? "check" : "do";
const MODE_TOKEN: Record<string, string> = {
  orient: "var(--color-signal-blue)",
  do: "var(--color-command-gold)",
  check: "var(--color-status-green)",
};

const HEX_PTS = "12,0 36,0 48,20.785 36,41.57 12,41.57 0,20.785";

/* ── shared hex node (variants A + D) ───────────────────────────── */
function Hex({
  n,
  state,
  size = 34,
  emphasis,
}: {
  n: string;
  state: IState;
  size?: number;
  emphasis: "outline" | "fill";
}) {
  const filled = emphasis === "fill" && state === "visited";
  const fill = filled ? "var(--color-command-gold)" : "none";
  const stroke =
    state === "unvisited"
      ? "color-mix(in srgb, var(--color-panel-border) 60%, transparent)"
      : "var(--color-command-gold)";
  const sw = state === "active" ? 2.5 : 1.5;
  const numColor = filled
    ? "var(--color-deep-space)"
    : state === "active"
      ? "var(--color-gold-light)"
      : state === "visited"
        ? "var(--color-command-gold)"
        : "var(--color-gray-3)";
  const ring = emphasis === "fill" && state === "active";
  return (
    <span
      style={{
        position: "relative",
        width: size,
        height: size * 0.866,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ring ? (
        <svg
          viewBox="0 0 48 41.57"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: -5, width: "auto", height: "auto", overflow: "visible" }}
          width={size + 10}
          height={size * 0.866 + 10}
        >
          <polygon
            points={HEX_PTS}
            style={{ fill: "none", stroke: "var(--color-command-gold)", strokeWidth: 1, opacity: 0.5, vectorEffect: "non-scaling-stroke" }}
          />
        </svg>
      ) : null}
      <svg
        viewBox="0 0 48 41.57"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          filter:
            state === "active"
              ? "drop-shadow(0 0 6px color-mix(in srgb, var(--color-command-gold) 55%, transparent))"
              : undefined,
        }}
      >
        <polygon
          points={HEX_PTS}
          style={{ fill, stroke, strokeWidth: sw, strokeLinejoin: "round", vectorEffect: "non-scaling-stroke", transition: "fill .3s, stroke .3s" }}
        />
      </svg>
      <span
        className="font-numeral"
        style={{ position: "relative", zIndex: 1, fontWeight: 800, fontSize: size * 0.42, lineHeight: 1, color: numColor }}
      >
        {n}
      </span>
    </span>
  );
}

/* ── VARIANT A / D — vertical hex rail ──────────────────────────── */
function HexRail({ active, onPick, emphasis }: { active: number; onPick: (n: number) => void; emphasis: "outline" | "fill" }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, paddingBlock: 6 }}>
      {/* spine */}
      <div style={{ position: "absolute", top: 18, bottom: 18, width: 1, background: "color-mix(in srgb, var(--color-panel-border) 70%, transparent)" }} />
      {ISLANDS.map((is, i) => {
        const st = stateOf(i + 1, active);
        return (
          <button
            key={is.num}
            onClick={() => onPick(i + 1)}
            title={`${is.num} · ${is.title}`}
            className="focus-visible:outline-none"
            style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center", gap: 10 }}
          >
            <Hex n={is.num} state={st} emphasis={emphasis} />
            {st === "active" ? (
              <span className="font-mono" style={{ position: "absolute", left: "100%", whiteSpace: "nowrap", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-gold-light)", paddingLeft: 8 }}>
                {is.title}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── VARIANT B — dot + gold hairline spine ──────────────────────── */
function DotRail({ active, onPick }: { active: number; onPick: (n: number) => void }) {
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 18, paddingBlock: 8 }}>
      <div style={{ position: "absolute", top: 12, bottom: 12, width: 1, background: "color-mix(in srgb, var(--color-command-gold) 45%, transparent)" }} />
      {ISLANDS.map((is, i) => {
        const st = stateOf(i + 1, active);
        const dot =
          st === "active"
            ? { width: 13, height: 13, background: "var(--color-command-gold)", boxShadow: "0 0 0 3px color-mix(in srgb, var(--color-command-gold) 30%, transparent)" }
            : st === "visited"
              ? { width: 9, height: 9, background: "var(--color-gold-dim)" }
              : { width: 9, height: 9, background: "var(--color-deep-space)", border: "1px solid color-mix(in srgb, var(--color-panel-border) 80%, transparent)" };
        return (
          <button key={is.num} onClick={() => onPick(i + 1)} title={`${is.num} · ${is.title}`} className="focus-visible:outline-none" style={{ position: "relative", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <span style={{ display: "block", borderRadius: 999, transition: "all .3s", ...dot }} />
            {st === "active" ? (
              <span className="font-mono" style={{ position: "absolute", left: "100%", whiteSpace: "nowrap", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-gold-light)", paddingLeft: 12 }}>
                {is.num} · {is.title}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ── VARIANT C — mono numbered ticks ────────────────────────────── */
function TickRail({ active, onPick }: { active: number; onPick: (n: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingBlock: 6 }}>
      {ISLANDS.map((is, i) => {
        const st = stateOf(i + 1, active);
        const color = st === "active" ? "var(--color-gold-light)" : st === "visited" ? "var(--color-command-gold)" : "var(--color-gray-3)";
        return (
          <button key={is.num} onClick={() => onPick(i + 1)} title={`${is.num} · ${is.title}`} className="focus-visible:outline-none" style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: "3px 2px" }}>
            <span style={{ width: 14, height: 1, background: st === "unvisited" ? "color-mix(in srgb, var(--color-panel-border) 70%, transparent)" : "var(--color-command-gold)" }} />
            <span
              className="font-mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.16em",
                color,
                padding: st === "active" ? "2px 5px" : undefined,
                border: st === "active" ? "1px solid var(--color-command-gold)" : undefined,
                borderRadius: st === "active" ? 3 : undefined,
                transition: "color .3s",
              }}
            >
              {is.num}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── VARIANT E / F — mobile chip strip ──────────────────────────── */
function ChipStrip({ active, onPick, modeTint }: { active: number; onPick: (n: number) => void; modeTint: boolean }) {
  return (
    <div
      style={{ display: "flex", gap: 8, overflowX: "auto", padding: "10px 12px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", background: "color-mix(in srgb, var(--color-deep-space) 100%, transparent)" }}
    >
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
    <div className="space-y-5" style={{ paddingRight: 8 }}>
      {ISLANDS.map((is) => (
        <div key={is.num}>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>
            ▸ {is.num}
          </div>
          <div className="font-display" style={{ fontSize: 20, letterSpacing: "0.03em", color: "var(--color-title)", marginTop: 2 }}>
            {is.title}
          </div>
          <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text)", marginTop: 6 }}>
            Placeholder body copy for this island so the rail has a column to scroll against. The regulator drops five volts to three-three; the module never sees USB voltage directly.
          </p>
          <p className="font-serif" style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-muted)", marginTop: 6 }}>
            A second line of muted supporting copy to give the section some height.
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

/* mobile variant cell: a phone-width frame, sticky chip strip under a fake header */
function MobileCell({ id, text, modeTint }: { id: string; text: string; modeTint: boolean }) {
  const [active, setActive] = useState(4);
  return (
    <div>
      <Caption id={id} text={text} />
      <div style={{ width: 390, maxWidth: "100%", border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, height: 560, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 14px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)" }}>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>SCHEMATIC · L1.01</div>
          <div className="font-display" style={{ fontSize: 22, color: "var(--color-title)", letterSpacing: "0.03em" }}>Draw the WROOM breakout</div>
        </div>
        <ChipStrip active={active} onPick={setActive} modeTint={modeTint} />
        <div style={{ overflowY: "auto", padding: 14 }}>
          <MockBlocks />
        </div>
      </div>
    </div>
  );
}

export default function IslandRailSandbox() {
  const [theme, setTheme] = useState<string>("dark");
  const [aA, setAA] = useState(4);
  const [aB, setAB] = useState(4);
  const [aC, setAC] = useState(4);
  const [aD, setAD] = useState(4);

  // Non-persisting theme flip: drive the REAL <html data-theme> override, but
  // restore the visitor's original theme on unmount so the sandbox never
  // changes their saved preference.
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
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · GUIDE PACING</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6, WebkitTextStroke: "0.4px var(--color-title)" }}>Island rail variants</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 640 }}>
            Six rails against a mock 8-island column. Click any node to move the active state. Pick one desktop (A–D) + one mobile (E–F) winner. Flip the theme to judge BOTH — a variant that sings on deep-space can die on ivory.
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
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Desktop rails (hidden below xl in the real build)</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 28 }}>
          <DesktopCell id="A" text="hex-node rail · outline progress (PhaseComb sibling)" rail={<HexRail active={aA} onPick={setAA} emphasis="outline" />} />
          <DesktopCell id="B" text="dot + gold hairline spine (minimal)" rail={<DotRail active={aB} onPick={setAB} />} />
          <DesktopCell id="C" text="mono numbered ticks · gold ring on active" rail={<TickRail active={aC} onPick={setAC} />} />
          <DesktopCell id="D" text="hex-node rail · v2 filled ticks (visited = filled, current = ringed)" rail={<HexRail active={aD} onPick={setAD} emphasis="fill" />} />
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Mobile chip strips (sticky under header, shown at xl+ hidden)</div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <MobileCell id="E" text="chip strip · horizontal scroll" modeTint={false} />
          <MobileCell id="F" text="chip strip · mode-colour accent (orient/do/check)" modeTint={true} />
        </div>
      </section>
    </main>
  );
}
