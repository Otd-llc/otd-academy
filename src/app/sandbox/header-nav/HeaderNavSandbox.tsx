"use client";

// TEMP sandbox — mobile header nav expand/collapse (deleted before the PR).
// Goal (both academy + apex): on mobile the nav shows ONE line, and a click
// reveals anything past it. This styles the TWO decisions: the toggle affordance
// and the expansion treatment. Click a toggle to see it open. Token-only; theme
// toggle top-right. Everything renders at phone width (390px).

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const LINKS = ["Projects", "Curriculum", "Courses", "Pricing", "Library", "Tools", "Learn", "Parts"];
const HIDDEN = 4; // mock "past the first line" count
const HAIR = "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)";
const FADE = "linear-gradient(90deg, #000 78%, transparent)";

function NavLink({ label, i, block = false }: { label: string; i: number; block?: boolean }) {
  const active = i === 0;
  return (
    <a
      href="#"
      onClick={(e) => e.preventDefault()}
      className={`font-mono transition-colors ${active ? "text-command-gold" : "text-muted hover:text-command-gold"} focus-visible:text-gold-light focus-visible:outline-none`}
      style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", textDecoration: "none", whiteSpace: "nowrap", display: block ? "block" : undefined, padding: block ? "0.45rem 0" : undefined }}
    >
      {label}
    </a>
  );
}

function Brand() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <BrandMark className="h-6 w-6 shrink-0 text-command-gold" />
      <span className="font-display" style={{ fontSize: 16, letterSpacing: "0.06em", color: "var(--color-title)", whiteSpace: "nowrap" }}>
        OTD <span style={{ color: "var(--color-command-gold)" }}>ACADEMY</span>
      </span>
    </span>
  );
}

function RightCluster() {
  return (
    <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
      <span style={{ color: "var(--color-muted)", fontSize: 15 }}>◐</span>
      <span style={{ width: 26, height: 26, borderRadius: 999, background: "color-mix(in srgb, var(--color-command-gold) 20%, transparent)", border: "1px solid color-mix(in srgb, var(--color-command-gold) 50%, transparent)", display: "inline-block" }} />
    </span>
  );
}

function Head({ children }: { children: React.ReactNode }) {
  return <div style={{ background: "var(--color-deep-space)", borderBottom: "1px solid var(--color-panel-border)", padding: "8px 14px 10px" }}>{children}</div>;
}
function TopRow() {
  return <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Brand /><RightCluster /></div>;
}

const togBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: "var(--color-command-gold)", padding: "0 2px", lineHeight: 1, display: "inline-flex", alignItems: "center", gap: 5 };

/* clipped-to-one-line nav with a right fade + an unclipped toggle at the right */
function ClippedNav({ open, expandInline, toggle }: { open: boolean; expandInline: boolean; toggle: React.ReactNode }) {
  const collapsed = !(open && expandInline);
  return (
    <div style={{ position: "relative", marginTop: 9 }}>
      <nav
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 16px",
          maxHeight: collapsed ? 20 : 220,
          overflow: "hidden",
          transition: "max-height .28s ease",
          paddingRight: 52,
          maskImage: collapsed ? FADE : "none",
          WebkitMaskImage: collapsed ? FADE : "none",
        }}
      >
        {LINKS.map((l, i) => <NavLink key={l} label={l} i={i} />)}
      </nav>
      <div style={{ position: "absolute", top: -1, right: 0 }}>{toggle}</div>
    </div>
  );
}

/* ── panels (shown below the clipped nav for non-inline variants) ── */
function CardPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ marginTop: 10, border: HAIR, borderRadius: 8, background: "var(--color-navy-dark)", boxShadow: "var(--elev-raise)", overflow: "hidden" }}>
      {LINKS.slice(4).map((l, i) => (
        <div key={l} onClick={onClose} style={{ padding: "0 12px", borderTop: i === 0 ? undefined : HAIR }}>
          <NavLink label={l} i={i + 4} block />
        </div>
      ))}
    </div>
  );
}
function SheetPanel() {
  return (
    <div style={{ margin: "10px -14px 0", borderTop: HAIR, background: "var(--color-bg-2)" }}>
      {LINKS.slice(4).map((l, i) => (
        <div key={l} style={{ padding: "0 14px", borderTop: i === 0 ? undefined : HAIR }}>
          <NavLink label={l} i={i + 4} block />
        </div>
      ))}
    </div>
  );
}
function AccordionPanel() {
  return (
    <div style={{ marginTop: 10, border: HAIR, borderLeft: "2px solid var(--color-command-gold)", borderRadius: 6, padding: "0.5rem 0.9rem", display: "flex", flexDirection: "column" }}>
      {LINKS.slice(4).map((l, i) => <NavLink key={l} label={l} i={i + 4} block />)}
    </div>
  );
}
function ChipsPanel() {
  return (
    <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 7 }}>
      {LINKS.slice(4).map((l, i) => (
        <a key={l} href="#" onClick={(e) => e.preventDefault()} className="font-mono text-muted transition-colors hover:text-command-gold focus-visible:outline-none" style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", textDecoration: "none", padding: "0.3rem 0.65rem", border: HAIR, borderRadius: 4, whiteSpace: "nowrap" }}>
          {l}
        </a>
      ))}
    </div>
  );
}

/* ── toggles ── */
const chevron = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} aria-label="More" className="focus-visible:outline-none" style={togBtn}>
    <span style={{ fontSize: 15, transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
  </button>
);
const moreCount = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} className="font-mono focus-visible:outline-none" style={{ ...togBtn, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
    {open ? "Less" : `More +${HIDDEN}`} <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
  </button>
);
const countBadge = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} aria-label="More" className="font-mono focus-visible:outline-none" style={{ ...togBtn, fontSize: 10, fontWeight: 700, color: "var(--color-deep-space)", background: "var(--color-command-gold)", borderRadius: 999, padding: "2px 8px" }}>
    {open ? "×" : `+${HIDDEN}`}
  </button>
);
const hamburger = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} aria-label="Menu" className="focus-visible:outline-none" style={{ ...togBtn, fontSize: 18 }}>
    {open ? "✕" : "≡"}
  </button>
);
const ellipsis = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} aria-label="More" className="focus-visible:outline-none" style={{ ...togBtn, fontSize: 18, letterSpacing: "0.05em" }}>
    {open ? "✕" : "···"}
  </button>
);
const menuText = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} className="font-mono focus-visible:outline-none" style={{ ...togBtn, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase" }}>
    Menu <span style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>▾</span>
  </button>
);
const goldChip = (open: boolean, t: () => void) => (
  <button onClick={t} aria-expanded={open} className="font-mono focus-visible:outline-none" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 4, padding: "3px 9px", background: open ? "color-mix(in srgb, var(--color-command-gold) 10%, transparent)" : "none", cursor: "pointer" }}>
    {open ? "Less" : "More"}
  </button>
);

type Variant = { id: string; desc: string; toggle: (o: boolean, t: () => void) => React.ReactNode; inline?: boolean; panel?: (close: () => void) => React.ReactNode };

const VARIANTS: Variant[] = [
  { id: "H01", desc: "chevron ▾ · inline reveal (nav expands in place)", toggle: chevron, inline: true },
  { id: "H02", desc: "\"More +N\" · inline reveal", toggle: moreCount, inline: true },
  { id: "H03", desc: "count badge +N · inline reveal", toggle: countBadge, inline: true },
  { id: "H04", desc: "hamburger ≡ · dropdown card", toggle: hamburger, panel: (c) => <CardPanel onClose={c} /> },
  { id: "H05", desc: "ellipsis ··· · dropdown card", toggle: ellipsis, panel: (c) => <CardPanel onClose={c} /> },
  { id: "H06", desc: "chevron ▾ · full-width sheet (edge-to-edge)", toggle: chevron, panel: () => <SheetPanel /> },
  { id: "H07", desc: "\"Menu ▾\" · gold-spine accordion", toggle: menuText, panel: () => <AccordionPanel /> },
  { id: "H08", desc: "gold chip \"More\" · chips reveal", toggle: goldChip, panel: () => <ChipsPanel /> },
];

function Variant({ v }: { v: Variant }) {
  const [open, setOpen] = useState(false);
  const t = () => setOpen((o) => !o);
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-command-gold)", marginBottom: 10, maxWidth: 390 }}>
        ▸ {v.id} · <span style={{ color: "var(--color-muted)" }}>{v.desc}</span>
      </div>
      <div style={{ width: 390, border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, overflow: "hidden" }}>
        <Head>
          <TopRow />
          <ClippedNav open={open} expandInline={!!v.inline} toggle={v.toggle(open, t)} />
          {!v.inline && open ? v.panel!(() => setOpen(false)) : null}
        </Head>
        <div style={{ padding: "1.4rem 1rem", color: "var(--color-gray-3)", fontSize: 12 }} className="font-mono">▸ page content…</div>
      </div>
    </div>
  );
}

export default function HeaderNavSandbox() {
  const [theme, setTheme] = useState("dark");

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
    <main style={{ margin: "0 auto", padding: "40px 24px 80px", color: "var(--color-text)", maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--color-command-gold) 40%, transparent)", paddingBottom: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · MOBILE HEADER NAV</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6 }}>Nav expand — 8 takes</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 700 }}>
            One line of nav + a toggle for the overflow. Two decisions per variant: the toggle affordance and the expansion (inline / dropdown card / sheet / accordion / chips). Click a toggle to open it. Flip the theme to judge both.
          </p>
        </div>
        <button className="font-mono focus-visible:outline-none" style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 6, padding: "9px 14px", background: "none", cursor: "pointer" }} onClick={flip}>
          Theme · {theme === "dark" ? "◑ dark" : "◐ light"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginTop: 32, alignItems: "flex-start" }}>
        {VARIANTS.map((v) => <Variant key={v.id} v={v} />)}
      </div>
    </main>
  );
}
