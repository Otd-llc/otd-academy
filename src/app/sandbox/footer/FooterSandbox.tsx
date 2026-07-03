"use client";

// TEMP sandbox — footer MOBILE round (deleted before the PR). Desktop is LOCKED
// to F02 + W02 (right-bleed bee, dark .10 / light .06). The mobile reflow was
// one tall narrow column (a maxWidth:70% meant for the desktop bee was crushing
// it) — this round is 8 mobile LAYOUTS at 390px, watermark held at W02, tuned
// per layout. Theme toggle only (everything renders at phone width).

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const GROUPS: { h: string; links: [string, boolean][] }[] = [
  { h: "Learn", links: [["Courses", false], ["Library", false], ["Glossary", false], ["Tools", false]] },
  { h: "Catalog", links: [["Parts", false], ["Briefs", false]] },
  { h: "Account", links: [["Sign in", false], ["Pricing", false], ["Verify", false], ["License", false]] },
  { h: "Company", links: [["Main site", true], ["About", true], ["Contact", true]] },
];
const REGISTRY = ["Broken Arrow, OK · USA", "SAM.gov Registered · CAGE 1ZYS4", "UEI WDQXD9L9UFH3"];
const HAIR = "1px solid color-mix(in srgb, var(--color-panel-border) 55%, transparent)";

// W02 watermark, theme-aware (dark .10 / light .06); position/size per layout.
function Bee({ w, style, od = 0.1, ol = 0.06 }: { w: string; style: React.CSSProperties; od?: number; ol?: number }) {
  const s = { position: "absolute", pointerEvents: "none", width: w, "--od": String(od), "--ol": String(ol) } as React.CSSProperties;
  return (
    <div aria-hidden className="beewm" style={{ ...s, ...style }}>
      <BrandMark className="block h-auto w-full" />
    </div>
  );
}

function Wordmark({ center = false, tag = true }: { center?: boolean; tag?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem" }}>
        <span style={{ width: "1.5rem", height: "1.5rem", color: "var(--color-command-gold)", display: "block", flexShrink: 0 }}>
          <BrandMark className="block h-full w-full" />
        </span>
        <span className="font-display" style={{ fontSize: "1.25rem", letterSpacing: "0.09em", color: "var(--color-title)", lineHeight: 1 }}>ONE THOUSAND DRONES</span>
      </span>
      {tag ? <p className="font-mono" style={{ fontSize: 11.5, letterSpacing: "0.03em", color: "var(--color-gray-3)", marginTop: "0.6rem" }}>One mind, many machines.</p> : null}
    </div>
  );
}

function A({ label, ext, small = false }: { label: string; ext: boolean; small?: boolean }) {
  return (
    <a href="#" onClick={(e) => e.preventDefault()} className="font-mono text-muted transition-colors hover:text-title focus-visible:text-gold-light focus-visible:outline-none" style={{ fontSize: small ? 12 : 13, letterSpacing: "0.04em", textDecoration: "none", padding: small ? "0.1rem 0" : "0.16rem 0", whiteSpace: "nowrap" }}>
      {label}{ext ? <span style={{ color: "var(--color-signal-blue)", fontSize: 10 }}> ↗</span> : null}
    </a>
  );
}

function Kick({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-title)", ...style }}>{children}</span>;
}

function RegistryText({ center = false }: { center?: boolean }) {
  return (
    <p className="font-mono" style={{ fontSize: 10.5, lineHeight: 1.8, letterSpacing: "0.04em", color: "var(--color-gray-3)", textAlign: center ? "center" : "left" }}>
      {REGISTRY.map((r, i) => (<span key={i}>{r}<br /></span>))}
    </p>
  );
}

function Copy({ center = false }: { center?: boolean }) {
  return <p className="font-mono" style={{ fontSize: 10, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--color-gray-3)", marginTop: "1.5rem", textAlign: center ? "center" : "left" }}>© 2026 One Thousand Drones, LLC</p>;
}

/* two-column link grid (the core fix — no maxWidth crush) */
function Cols2({ center = false }: { center?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.4rem 1rem", marginTop: "1.6rem", justifyItems: center ? "center" : "start" }}>
      {GROUPS.map((g) => (
        <div key={g.h} style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start" }}>
          <Kick style={{ marginBottom: "0.6rem" }}>{g.h}</Kick>
          {g.links.map(([label, ext]) => <A key={label} label={label} ext={ext} small />)}
        </div>
      ))}
    </div>
  );
}

/* one row per group: kicker then inline-wrapped links */
function InlineGroups() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.6rem" }}>
      {GROUPS.map((g) => (
        <div key={g.h} style={{ borderTop: HAIR, paddingTop: "0.8rem" }}>
          <Kick style={{ display: "block", marginBottom: "0.4rem" }}>{g.h}</Kick>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem 1rem" }}>
            {g.links.map(([label, ext]) => <A key={label} label={label} ext={ext} small />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* label-left, links-right per group row */
function LabelRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: "1.4rem" }}>
      {GROUPS.map((g) => (
        <div key={g.h} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: "0.8rem", alignItems: "start", padding: "0.8rem 0", borderTop: HAIR }}>
          <Kick style={{ paddingTop: "0.15rem" }}>{g.h}</Kick>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem 0.9rem" }}>
            {g.links.map(([label, ext]) => <A key={label} label={label} ext={ext} small />)}
          </div>
        </div>
      ))}
    </div>
  );
}

/* every link as a hairline chip, wrapped */
function Chips() {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "1.6rem" }}>
      {GROUPS.flatMap((g) => g.links).map(([label, ext]) => (
        <a key={label} href="#" onClick={(e) => e.preventDefault()} className="font-mono text-muted transition-colors hover:text-title focus-visible:text-gold-light focus-visible:outline-none" style={{ fontSize: 11.5, letterSpacing: "0.06em", textDecoration: "none", padding: "0.3rem 0.7rem", border: HAIR, borderRadius: 4, whiteSpace: "nowrap" }}>
          {label}{ext ? <span style={{ color: "var(--color-signal-blue)", fontSize: 10 }}> ↗</span> : null}
        </a>
      ))}
    </div>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
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
      {children}
    </div>
  );
}
function Inner({ children }: { children: React.ReactNode }) {
  return <div style={{ position: "relative", padding: "2.4rem 1.25rem 1.8rem" }}>{children}</div>;
}

type Variant = { id: string; desc: string; render: () => React.ReactNode };

const VARIANTS: Variant[] = [
  {
    id: "M01",
    desc: "2-column links · bee bottom-right",
    render: () => (
      <Frame>
        <Bee w="50%" style={{ bottom: "-8%", right: "-12%" }} />
        <Inner>
          <Wordmark />
          <Cols2 />
          <div style={{ borderTop: HAIR, margin: "1.6rem 0 0" }} />
          <div style={{ marginTop: "1.2rem" }}><RegistryText /></div>
          <Copy />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M02",
    desc: "brand centered · 2-col centered · bee bottom-center",
    render: () => (
      <Frame>
        <Bee w="64%" style={{ bottom: "-16%", left: "50%", transform: "translateX(-50%)" }} />
        <Inner>
          <Wordmark center />
          <Cols2 center />
          <div style={{ borderTop: HAIR, margin: "1.6rem 0 1.2rem" }} />
          <RegistryText center />
          <Copy center />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M03",
    desc: "inline groups (kicker + wrapped links per row) · bee bottom-right",
    render: () => (
      <Frame>
        <Bee w="46%" style={{ bottom: "-6%", right: "-14%" }} />
        <Inner>
          <Wordmark />
          <InlineGroups />
          <div style={{ borderTop: HAIR, margin: "1rem 0 0", paddingTop: "0.8rem" }}><RegistryText /></div>
          <Copy />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M04",
    desc: "link chips (all links, wrapped) · bee bottom watermark",
    render: () => (
      <Frame>
        <Bee w="58%" style={{ bottom: "-14%", left: "50%", transform: "translateX(-50%)" }} />
        <Inner>
          <Wordmark />
          <Chips />
          <div style={{ borderTop: HAIR, margin: "1.6rem 0 1.2rem" }} />
          <RegistryText />
          <Copy />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M05",
    desc: "label-left / links-right rows · bee right-bleed (small)",
    render: () => (
      <Frame>
        <Bee w="40%" style={{ top: "42%", right: "-18%", transform: "translateY(-50%)" }} />
        <Inner>
          <Wordmark />
          <LabelRows />
          <div style={{ borderTop: HAIR, margin: "0.4rem 0 0", paddingTop: "0.9rem" }}><RegistryText /></div>
          <Copy />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M06",
    desc: "2-col links + registry/copy in a raised bg-2 band · bee behind band",
    render: () => (
      <div>
        <Frame>
          <Inner>
            <Wordmark />
            <Cols2 />
          </Inner>
        </Frame>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--color-bg-2)" }}>
          <Bee w="44%" style={{ top: "50%", right: "-14%", transform: "translateY(-50%)" }} />
          <div style={{ position: "relative", padding: "1.4rem 1.25rem" }}>
            <RegistryText />
            <Copy />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "M07",
    desc: "centered everything · giant faint bee center-behind",
    render: () => (
      <Frame>
        <Bee w="88%" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} od={0.08} />
        <Inner>
          <Wordmark center />
          <Cols2 center />
          <div style={{ borderTop: HAIR, margin: "1.6rem auto 1.2rem", maxWidth: 200 }} />
          <RegistryText center />
          <Copy center />
        </Inner>
      </Frame>
    ),
  },
  {
    id: "M08",
    desc: "compact · brand + chips + one-line copy · bee bottom-right",
    render: () => (
      <Frame>
        <Bee w="42%" style={{ bottom: "-8%", right: "-12%" }} />
        <Inner>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <Wordmark tag={false} />
            <Chips />
          </div>
          <div style={{ borderTop: HAIR, margin: "1.4rem 0 0", paddingTop: "0.9rem", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.6rem", alignItems: "baseline" }}>
            <RegistryText />
            <span className="font-mono" style={{ fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--color-gray-3)" }}>© 2026 OTD, LLC</span>
          </div>
        </Inner>
      </Frame>
    ),
  },
];

export default function FooterSandbox() {
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

  const btn: React.CSSProperties = { fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-command-gold)", border: "1px solid var(--color-command-gold)", borderRadius: 6, padding: "9px 14px", background: "none", cursor: "pointer" };

  return (
    <main style={{ margin: "0 auto", padding: "40px 24px 80px", color: "var(--color-text)", maxWidth: 1240 }}>
      <style>{`
        .beewm { color: var(--color-command-gold); opacity: .06; }
        [data-theme="dark"] .beewm { opacity: var(--od, .1); }
        [data-theme="light"] .beewm { opacity: var(--ol, .06); }
      `}</style>

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--color-command-gold) 40%, transparent)", paddingBottom: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · FOOTER · MOBILE LAYOUTS</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6 }}>Footer mobile — 8 layouts</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 700 }}>
            Desktop LOCKED (F02 + W02). This round fixes the phone reflow — 8 mobile layouts at 390px (2-col, inline-groups, label-rows, chips, centered, band), watermark held at W02. Flip the theme to judge both.
          </p>
        </div>
        <button className="font-mono focus-visible:outline-none" style={btn} onClick={flip}>Theme · {theme === "dark" ? "◑ dark" : "◐ light"}</button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 32, marginTop: 32 }}>
        {VARIANTS.map((v) => (
          <div key={v.id}>
            <div className="font-mono" style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-command-gold)", marginBottom: 10, maxWidth: 390 }}>
              ▸ {v.id} · <span style={{ color: "var(--color-muted)" }}>{v.desc}</span>
            </div>
            <div style={{ width: 390, border: "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)", borderRadius: 14, overflow: "hidden" }}>
              {v.render()}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
