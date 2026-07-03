"use client";

// TEMP sandbox — footer redesign CONVERGE round (deleted before the PR). Josh
// picked F02 (bee bleeding off the right edge, columns left); LIGHT is right as-
// is, but the DARK watermark is too faint (0.06 gold on near-black barely
// reads). All 10 keep the F02 layout and vary ONLY the watermark, tuned per
// theme via [data-theme] so LIGHT holds ~0.06 and DARK boosts independently.

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const GROUPS: { h: string; links: [string, boolean][] }[] = [
  { h: "Learn", links: [["Courses", false], ["Library", false], ["Glossary", false], ["Tools", false]] },
  { h: "Catalog", links: [["Parts", false], ["Briefs", false]] },
  { h: "Account", links: [["Sign in", false], ["Pricing", false], ["Verify", false], ["License", false]] },
  { h: "Company", links: [["Main site", true], ["About", true], ["Contact", true]] },
];
const REGISTRY = ["Broken Arrow, OK · USA", "SAM.gov Registered · CAGE 1ZYS4", "UEI WDQXD9L9UFH3"];

/* theme-aware bee watermark: --od/--ol drive dark/light opacity, --cd/--cl the
   tint; `.glow` adds a dark-only soft gold halo for edge definition. */
function Bee({ w, od, ol, cd = "var(--color-command-gold)", cl = "var(--color-command-gold)", right, glow = false }: { w: string; od: number; ol: number; cd?: string; cl?: string; right: string; glow?: boolean }) {
  const style = { position: "absolute", pointerEvents: "none", width: w, top: "50%", right, transform: "translateY(-50%)", "--od": String(od), "--ol": String(ol), "--cd": cd, "--cl": cl } as React.CSSProperties;
  return (
    <div aria-hidden className={`beewm${glow ? " glow" : ""}`} style={style}>
      <BrandMark className="block h-auto w-full" />
    </div>
  );
}

function Wordmark() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ width: "1.7rem", height: "1.7rem", color: "var(--color-command-gold)", display: "block", flexShrink: 0 }}>
          <BrandMark className="block h-full w-full" />
        </span>
        <span className="font-display" style={{ fontSize: "1.5rem", letterSpacing: "0.1em", color: "var(--color-title)", lineHeight: 1 }}>ONE THOUSAND DRONES</span>
      </span>
      <p className="font-mono" style={{ fontSize: 12, letterSpacing: "0.03em", color: "var(--color-gray-3)", marginTop: "0.7rem" }}>One mind, many machines.</p>
    </div>
  );
}

function Link({ label, ext }: { label: string; ext: boolean }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="font-mono text-muted transition-colors hover:text-title focus-visible:text-gold-light focus-visible:outline-none" style={{ fontSize: 13, letterSpacing: "0.04em", textDecoration: "none", padding: "0.18rem 0", whiteSpace: "nowrap" }}>
      {label} {ext ? <span style={{ color: "var(--color-signal-blue)", fontSize: 11 }}>↗</span> : null}
    </a>
  );
}

function GroupHead({ children }: { children: React.ReactNode }) {
  return <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-title)", marginBottom: "0.85rem" }}>{children}</span>;
}

function Groups() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1.7rem 1.3rem", marginTop: "1.8rem", maxWidth: "70%" }}>
      {GROUPS.map((g) => (
        <div key={g.h} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <GroupHead>{g.h}</GroupHead>
          {g.links.map(([label, ext]) => <Link key={label} label={label} ext={ext} />)}
        </div>
      ))}
      <div style={{ display: "flex", flexDirection: "column" }}>
        <GroupHead>Registry</GroupHead>
        <p className="font-mono" style={{ fontSize: 10.5, lineHeight: 1.85, letterSpacing: "0.04em", color: "var(--color-gray-3)" }}>
          {REGISTRY.map((r, i) => (<span key={i}>{r}<br /></span>))}
        </p>
      </div>
    </div>
  );
}

function FooterF02({ bee }: { bee: React.ReactNode }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid transparent",
        borderImage: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-command-gold) 55%, transparent), transparent) 1",
        background: "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-command-gold) 5%, transparent), transparent 60%), var(--color-deep-space)",
      }}
    >
      {bee}
      <div style={{ position: "relative", maxWidth: "72rem", margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>
        <Wordmark />
        <Groups />
        <p className="font-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-gray-3)", marginTop: "2rem" }}>© 2026 One Thousand Drones, LLC</p>
      </div>
    </div>
  );
}

type Variant = { id: string; desc: string; bee: React.ReactNode };
const GOLD = "var(--color-command-gold)";
const GOLDL = "var(--color-gold-light)";

const VARIANTS: Variant[] = [
  { id: "W01", desc: "baseline F02 · dark .06 / light .06 (the too-faint dark reference)", bee: <Bee w="46%" od={0.06} ol={0.06} right="-10%" /> },
  { id: "W02", desc: "dark .10 / light .06", bee: <Bee w="46%" od={0.1} ol={0.06} right="-10%" /> },
  { id: "W03", desc: "dark .14 / light .06", bee: <Bee w="46%" od={0.14} ol={0.06} right="-10%" /> },
  { id: "W04", desc: "dark .18 / light .05 (strongest)", bee: <Bee w="46%" od={0.18} ol={0.05} right="-10%" /> },
  { id: "W05", desc: "dark .14 in gold-LIGHT tint (brighter gold) / light .06 command-gold", bee: <Bee w="46%" od={0.14} ol={0.06} cd={GOLDL} cl={GOLD} right="-10%" /> },
  { id: "W06", desc: "bigger bee 58% · dark .10 / light .05", bee: <Bee w="58%" od={0.1} ol={0.05} right="-12%" /> },
  { id: "W07", desc: "more bleed (56%, right -22%, only the front shows) · dark .13 / light .06", bee: <Bee w="56%" od={0.13} ol={0.06} right="-22%" /> },
  { id: "W08", desc: "dark .12 + soft gold GLOW (edge pop, dark only) / light .06", bee: <Bee w="46%" od={0.12} ol={0.06} right="-10%" glow /> },
  { id: "W09", desc: "shifted in-frame (right -4%, more of the bee) · dark .16 / light .07", bee: <Bee w="46%" od={0.16} ol={0.07} right="-4%" /> },
  { id: "W10", desc: "two-tone brightness · dark gold-LIGHT .15 / light command-gold .07 · 50%", bee: <Bee w="50%" od={0.15} ol={0.07} cd={GOLDL} cl={GOLD} right="-10%" /> },
];

export default function FooterSandbox() {
  const [theme, setTheme] = useState("dark");
  const [mobile, setMobile] = useState(false);

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

  const btn: React.CSSProperties = { fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 6, padding: "9px 14px", background: "none", cursor: "pointer" };

  return (
    <main style={{ margin: "0 auto", padding: "40px 24px 80px", color: "var(--color-text)", maxWidth: 1240 }}>
      <style>{`
        .beewm { color: var(--color-command-gold); opacity: .06; }
        [data-theme="dark"] .beewm { opacity: var(--od, .06); color: var(--cd, var(--color-command-gold)); }
        [data-theme="light"] .beewm { opacity: var(--ol, .06); color: var(--cl, var(--color-command-gold)); }
        [data-theme="dark"] .beewm.glow { filter: drop-shadow(0 0 26px color-mix(in srgb, var(--color-command-gold) 45%, transparent)); }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--color-command-gold) 40%, transparent)", paddingBottom: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · FOOTER · F02 WATERMARK CONVERGE</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6 }}>F02 · 10 watermark takes</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 700 }}>
            Same F02 layout, watermark tuned for DARK visibility while LIGHT holds where you approved it (~.06). Flip the theme to compare — the dark values differ per variant, light barely moves. Toggle Mobile for the reflow.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button className="font-mono focus-visible:outline-none" style={btn} onClick={flip}>Theme · {theme === "dark" ? "◑ dark" : "◐ light"}</button>
          <button className="font-mono focus-visible:outline-none" style={btn} onClick={() => setMobile((m) => !m)}>View · {mobile ? "▯ mobile" : "▭ desktop"}</button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 40, marginTop: 32 }}>
        {VARIANTS.map((v) => (
          <div key={v.id}>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-command-gold)", marginBottom: 10 }}>
              ▸ {v.id} · <span style={{ color: "var(--color-muted)" }}>{v.desc}</span>
            </div>
            <div style={{ width: mobile ? 390 : "100%", maxWidth: "100%", margin: mobile ? "0 auto" : undefined, border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, overflow: "hidden" }}>
              <FooterF02 bee={v.bee} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
