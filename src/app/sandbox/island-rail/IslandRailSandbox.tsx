"use client";

// TEMP sandbox (guide-pacing Task 3) — deleted before the PR (Task 9).
// ROUND 4: desktop LOCKED to B3c (Saira number-as-node); now 5 mobile options
// (M1–M5), all echoing the Saira numeral for continuity. Josh picks one mobile.
//
// Token-only; the theme flip drives the REAL shipped :root[data-theme="light"]
// override, so any hardcoded colour visibly fails to flip.

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
const numColor = (st: IState) =>
  st === "active" ? "var(--color-gold-light)" : st === "visited" ? "var(--color-command-gold)" : "var(--color-gray-3)";

function Saira({ children, color, size = 16 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <span className="font-numeral" style={{ fontSize: size, fontWeight: 800, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", lineHeight: 1, color }}>
      {children}
    </span>
  );
}

/* ── DESKTOP (locked) — B3c: Saira number sits on the spine ─────── */
function NumRailB3c({ active, onPick }: { active: number; onPick: (n: number) => void }) {
  const n = ISLANDS.length;
  const rowH = 24;
  const gap = 14;
  const pad = 6;
  const center = (i0: number) => pad + i0 * (rowH + gap) + rowH / 2;
  return (
    <div style={{ position: "relative", paddingBlock: pad, minWidth: 158 }}>
      <div style={{ position: "absolute", left: 17, top: center(0), height: center(n - 1) - center(0), width: 1, background: "color-mix(in srgb, var(--color-command-gold) 40%, transparent)" }} />
      <div style={{ display: "flex", flexDirection: "column", gap }}>
        {ISLANDS.map((is, i) => {
          const st = stateOf(i + 1, active);
          return (
            <button key={is.num} onClick={() => onPick(i + 1)} title={`${is.num} · ${is.title}`} className="focus-visible:outline-none" style={{ height: rowH, display: "grid", gridTemplateColumns: "34px 1fr", alignItems: "center", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
              <span style={{ justifySelf: "center", background: "var(--color-deep-space)", padding: st === "active" ? "2px 5px" : "1px 5px", border: st === "active" ? "1px solid var(--color-command-gold)" : "1px solid transparent", borderRadius: 3 }}>
                <Saira color={numColor(st)} size={18}>{is.num}</Saira>
              </span>
              {st === "active" ? (
                <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-gold-light)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingLeft: 8 }}>{is.title}</span>
              ) : (
                <span />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* shared mock column + chrome ───────────────────────────────────── */
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

/* phone-width frame: fixed header, a nav slot, then the scrolling block region */
function MobileFrame({ id, text, nav }: { id: string; text: string; nav: React.ReactNode }) {
  return (
    <div>
      <Caption id={id} text={text} />
      <div style={{ position: "relative", width: 360, maxWidth: "100%", border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, height: 560, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: "0 0 auto", padding: "12px 14px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)" }}>
          <div className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>SCHEMATIC · L1.01</div>
          <div className="font-display" style={{ fontSize: 22, color: "var(--color-title)", letterSpacing: "0.03em" }}>Draw the WROOM breakout</div>
        </div>
        {nav}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14 }}>
          <MockBlocks />
        </div>
      </div>
    </div>
  );
}

const navBar: React.CSSProperties = { flex: "0 0 auto", padding: "10px 12px", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", background: "var(--color-deep-space)" };

/* M1 — number chips: Saira number only, active expands to show its title */
function M1() {
  const [active, setActive] = useState(4);
  return (
    <MobileFrame
      id="M1"
      text="number chips · Saira, active expands to title"
      nav={
        <div style={{ ...navBar, display: "flex", gap: 8, overflowX: "auto" }}>
          {ISLANDS.map((is, i) => {
            const st = stateOf(i + 1, active);
            return (
              <button key={is.num} onClick={() => setActive(i + 1)} className="focus-visible:outline-none" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 9px", cursor: "pointer", borderRadius: 3, border: st === "active" ? "1px solid var(--color-command-gold)" : "1px solid color-mix(in srgb, var(--color-panel-border) 55%, transparent)", background: st === "active" ? "color-mix(in srgb, var(--color-command-gold) 8%, transparent)" : "none", whiteSpace: "nowrap" }}>
                <Saira color={numColor(st)} size={15}>{is.num}</Saira>
                {st === "active" ? <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-gold-light)" }}>{is.title}</span> : null}
              </button>
            );
          })}
        </div>
      }
    />
  );
}

/* M2 — full chips: Saira number + title, horizontal scroll (the original E) */
function M2() {
  const [active, setActive] = useState(4);
  return (
    <MobileFrame
      id="M2"
      text="full chips · number + title, horizontal scroll"
      nav={
        <div style={{ ...navBar, display: "flex", gap: 8, overflowX: "auto" }}>
          {ISLANDS.map((is, i) => {
            const st = stateOf(i + 1, active);
            return (
              <button key={is.num} onClick={() => setActive(i + 1)} className="focus-visible:outline-none" style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px", cursor: "pointer", borderRadius: 3, border: st === "active" ? "1px solid var(--color-command-gold)" : "1px solid color-mix(in srgb, var(--color-panel-border) 55%, transparent)", background: st === "active" ? "color-mix(in srgb, var(--color-command-gold) 8%, transparent)" : "none", whiteSpace: "nowrap" }}>
                <Saira color={numColor(st)} size={14}>{is.num}</Saira>
                <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: numColor(st) }}>{is.title}</span>
              </button>
            );
          })}
        </div>
      }
    />
  );
}

/* M3 — progress meter: current label + a segmented gold progress bar */
function M3() {
  const [active, setActive] = useState(4);
  const cur = ISLANDS[active - 1]!;
  return (
    <MobileFrame
      id="M3"
      text="progress meter · current label + segmented bar"
      nav={
        <div style={{ ...navBar, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>ISLAND</span>
            <Saira color="var(--color-gold-light)" size={20}>{cur.num}</Saira>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--color-gray-3)" }}>/ {ISLANDS.length}</span>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur.title}</span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {ISLANDS.map((is, i) => {
              const done = i + 1 <= active;
              return <button key={is.num} onClick={() => setActive(i + 1)} title={`${is.num} · ${is.title}`} className="focus-visible:outline-none" style={{ flex: 1, height: 5, borderRadius: 2, border: "none", cursor: "pointer", padding: 0, background: done ? "var(--color-command-gold)" : "color-mix(in srgb, var(--color-panel-border) 70%, transparent)", transition: "background .3s" }} />;
            })}
          </div>
        </div>
      }
    />
  );
}

/* M4 — dropdown: a full-width field that opens the island list */
function M4() {
  const [active, setActive] = useState(4);
  const [open, setOpen] = useState(false);
  const cur = ISLANDS[active - 1]!;
  return (
    <MobileFrame
      id="M4"
      text="dropdown · tap the field to jump (scales to any length)"
      nav={
        <div style={{ ...navBar, position: "relative", zIndex: 5 }}>
          <button onClick={() => setOpen((o) => !o)} className="focus-visible:outline-none" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: "1px solid color-mix(in srgb, var(--color-panel-border) 70%, transparent)", borderRadius: 6, background: "none", padding: "8px 11px" }}>
            <span className="font-mono" style={{ fontSize: 9, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)" }}>JUMP</span>
            <Saira color="var(--color-gold-light)" size={17}>{cur.num}</Saira>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, textAlign: "left" }}>{cur.title}</span>
            <span style={{ color: "var(--color-command-gold)", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
          </button>
          {open ? (
            <div style={{ position: "absolute", top: "100%", left: 12, right: 12, marginTop: 4, maxHeight: 300, overflowY: "auto", background: "var(--color-deep-space)", border: "1px solid color-mix(in srgb, var(--color-panel-border) 75%, transparent)", borderRadius: 6, boxShadow: "var(--elev-card)", zIndex: 20 }}>
              {ISLANDS.map((is, i) => {
                const st = stateOf(i + 1, active);
                return (
                  <button key={is.num} onClick={() => { setActive(i + 1); setOpen(false); }} className="focus-visible:outline-none" style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", border: "none", borderBottom: "1px solid color-mix(in srgb, var(--color-panel-border) 45%, transparent)", background: st === "active" ? "color-mix(in srgb, var(--color-command-gold) 8%, transparent)" : "none", padding: "8px 11px", textAlign: "left" }}>
                    <Saira color={numColor(st)} size={15}>{is.num}</Saira>
                    <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase", color: st === "unvisited" ? "var(--color-muted)" : numColor(st) }}>{is.title}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      }
    />
  );
}

/* M5 — dot pager: current label + a centered dot row (no horizontal scroll) */
function M5() {
  const [active, setActive] = useState(4);
  const cur = ISLANDS[active - 1]!;
  return (
    <MobileFrame
      id="M5"
      text="dot pager · centered dots, no scroll (carousel feel)"
      nav={
        <div style={{ ...navBar, display: "flex", flexDirection: "column", gap: 9, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <Saira color="var(--color-gold-light)" size={18}>{cur.num}</Saira>
            <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--color-text)" }}>{cur.title}</span>
          </div>
          <div style={{ display: "flex", gap: 11, justifyContent: "center" }}>
            {ISLANDS.map((is, i) => {
              const st = stateOf(i + 1, active);
              return (
                <button key={is.num} onClick={() => setActive(i + 1)} title={`${is.num} · ${is.title}`} className="focus-visible:outline-none" style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }}>
                  <span style={{ width: st === "active" ? 12 : 8, height: st === "active" ? 12 : 8, borderRadius: 999, background: st === "active" ? "var(--color-command-gold)" : st === "visited" ? "var(--color-gold-dim)" : "var(--color-deep-space)", border: st === "unvisited" ? "1px solid color-mix(in srgb, var(--color-panel-border) 85%, transparent)" : undefined, boxShadow: st === "active" ? "0 0 0 3px color-mix(in srgb, var(--color-command-gold) 28%, transparent)" : undefined, transition: "all .3s" }} />
                </button>
              );
            })}
          </div>
        </div>
      }
    />
  );
}

export default function IslandRailSandbox() {
  const [theme, setTheme] = useState<string>("dark");
  const [dActive, setDActive] = useState(4);

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
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · GUIDE PACING · ROUND 4</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6, WebkitTextStroke: "0.4px var(--color-title)" }}>Island rail — mobile options</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 700 }}>
            Desktop locked to B3c (Saira number on the spine). Five mobile takes below, all echoing the Saira numeral. Tap nodes/segments/chips to move the active state; M4 opens on tap. Flip the theme to judge BOTH — pick one mobile.
          </p>
        </div>
        <button onClick={flip} className="font-mono focus-visible:outline-none" style={{ flex: "0 0 auto", fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 6, padding: "9px 14px", background: "none", cursor: "pointer" }}>
          Theme · {theme === "dark" ? "◑ dark" : "◐ light"} → flip
        </button>
      </div>

      <section style={{ marginTop: 32 }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Desktop · LOCKED = B3c (reference)</div>
        <div style={{ maxWidth: 560 }}>
          <div style={{ border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, height: 360, overflow: "hidden" }}>
            <div style={{ height: "100%", overflowY: "auto", display: "flex", gap: 16, padding: 18 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <MockBlocks />
              </div>
              <div style={{ flex: "0 0 auto", alignSelf: "flex-start", position: "sticky", top: 0 }}>
                <NumRailB3c active={dActive} onPick={setDActive} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 44 }}>
        <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-muted)", marginBottom: 18 }}>Mobile · pick one of five</div>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <M1 />
          <M2 />
          <M3 />
          <M4 />
          <M5 />
        </div>
      </section>
    </main>
  );
}
