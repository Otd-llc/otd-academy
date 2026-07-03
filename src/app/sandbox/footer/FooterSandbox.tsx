"use client";

// TEMP sandbox — footer redesign, 20 options (deleted before the PR). Every
// variant carries a large brand-icon (bee) watermark, the field-guide idea
// (the certificate/Library PDFs render a faint gold BrandMark as paper texture).
// Token-only so the theme flip proves the var-override; a desktop/mobile toggle
// constrains the preview width so each variant's reflow is visible.

import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

const GROUPS: { h: string; links: [string, boolean][] }[] = [
  { h: "Learn", links: [["Courses", false], ["Library", false], ["Glossary", false], ["Tools", false]] },
  { h: "Catalog", links: [["Parts", false], ["Briefs", false]] },
  { h: "Account", links: [["Sign in", false], ["Pricing", false], ["Verify", false], ["License", false]] },
  { h: "Company", links: [["Main site", true], ["About", true], ["Contact", true]] },
];
const ALL_LINKS: [string, boolean][] = GROUPS.flatMap((g) => g.links);
const REGISTRY = ["Broken Arrow, OK · USA", "SAM.gov Registered · CAGE 1ZYS4", "UEI WDQXD9L9UFH3"];

/* ── shared pieces ─────────────────────────────────────────────── */
function Bee({ w, opacity, style }: { w: string; opacity: number; style: React.CSSProperties }) {
  return (
    <div aria-hidden style={{ position: "absolute", pointerEvents: "none", color: "var(--color-command-gold)", width: w, opacity, ...style }}>
      <BrandMark className="block h-auto w-full" />
    </div>
  );
}

function Wordmark({ center = false, tag = true, wm = "1.5rem", bee = "1.7rem" }: { center?: boolean; tag?: boolean; wm?: string; bee?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: center ? "center" : "flex-start" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ width: bee, height: bee, color: "var(--color-command-gold)", display: "block", flexShrink: 0 }}>
          <BrandMark className="block h-full w-full" />
        </span>
        <span className="font-display" style={{ fontSize: wm, letterSpacing: "0.1em", color: "var(--color-title)", lineHeight: 1 }}>ONE THOUSAND DRONES</span>
      </span>
      {tag ? <p className="font-mono" style={{ fontSize: 12, letterSpacing: "0.03em", color: "var(--color-gray-3)", marginTop: "0.7rem" }}>One mind, many machines.</p> : null}
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

function Groups({ style, withRegistry = true }: { style?: React.CSSProperties; withRegistry?: boolean }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1.7rem 1.3rem", ...style }}>
      {GROUPS.map((g) => (
        <div key={g.h} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <GroupHead>{g.h}</GroupHead>
          {g.links.map(([label, ext]) => <Link key={label} label={label} ext={ext} />)}
        </div>
      ))}
      {withRegistry ? (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <GroupHead>Registry</GroupHead>
          <p className="font-mono" style={{ fontSize: 10.5, lineHeight: 1.85, letterSpacing: "0.04em", color: "var(--color-gray-3)" }}>
            {REGISTRY.map((r, i) => (<span key={i}>{r}<br /></span>))}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Copy({ center = false }: { center?: boolean }) {
  return <p className="font-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-gray-3)", marginTop: "2rem", textAlign: center ? "center" : "left" }}>© 2026 One Thousand Drones, LLC</p>;
}

const HAIR = "1px solid color-mix(in srgb, var(--color-panel-border) 60%, transparent)";

function Shell({ bee, children, raised = false }: { bee: React.ReactNode; children: React.ReactNode; raised?: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderTop: "1px solid transparent",
        borderImage: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-command-gold) 55%, transparent), transparent) 1",
        background: raised
          ? "var(--color-bg-2)"
          : "radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-command-gold) 5%, transparent), transparent 60%), var(--color-deep-space)",
      }}
    >
      {bee}
      <div style={{ position: "relative", maxWidth: "72rem", margin: "0 auto", padding: "3rem 1.5rem 2rem" }}>{children}</div>
    </div>
  );
}

/* ── 20 variants ───────────────────────────────────────────────── */
type Variant = { id: string; desc: string; render: () => React.ReactNode };

const inlineNav = (
  <nav style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem 1.2rem" }}>
    {ALL_LINKS.map(([label, ext]) => <Link key={label} label={label} ext={ext} />)}
  </nav>
);

const VARIANTS: Variant[] = [
  {
    id: "F01",
    desc: "giant bee centered behind · brand left, columns right",
    render: () => (
      <Shell bee={<Bee w="62%" opacity={0.05} style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 260 }}><Wordmark /></div>
          <Groups style={{ flex: 1, minWidth: 300 }} />
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F02",
    desc: "bee bleeding off the RIGHT edge · columns left",
    render: () => (
      <Shell bee={<Bee w="46%" opacity={0.06} style={{ top: "50%", right: "-10%", transform: "translateY(-50%)" }} />}>
        <Wordmark />
        <Groups style={{ marginTop: "1.8rem", maxWidth: "70%" }} />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F03",
    desc: "bee bleeding off the LEFT edge · columns right-aligned",
    render: () => (
      <Shell bee={<Bee w="46%" opacity={0.06} style={{ top: "50%", left: "-10%", transform: "translateY(-50%)" }} />}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}><Wordmark /></div>
        <Groups style={{ marginTop: "1.8rem", marginLeft: "auto", maxWidth: "72%" }} />
        <Copy center />
      </Shell>
    ),
  },
  {
    id: "F04",
    desc: "bee rising from the bottom-center (top of the bee shows)",
    render: () => (
      <Shell bee={<Bee w="52%" opacity={0.07} style={{ bottom: "-26%", left: "50%", transform: "translateX(-50%)" }} />}>
        <div style={{ textAlign: "center" }}><Wordmark center /></div>
        <Groups style={{ marginTop: "1.8rem" }} />
        <Copy center />
      </Shell>
    ),
  },
  {
    id: "F05",
    desc: "oversized bee cropped bottom-right corner · minimal",
    render: () => (
      <Shell bee={<Bee w="38%" opacity={0.08} style={{ bottom: "-14%", right: "-6%" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Wordmark />
          {inlineNav}
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F06",
    desc: "bee backing the WORDMARK (large behind the brand block)",
    render: () => (
      <Shell bee={<Bee w="24%" opacity={0.11} style={{ top: "1.2rem", left: "0.6rem" }} />}>
        <Wordmark wm="1.7rem" />
        <Groups style={{ marginTop: "2rem" }} />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F07",
    desc: "bee as a full-width faint band across the footer",
    render: () => (
      <Shell bee={<Bee w="120%" opacity={0.03} style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <Wordmark />
        <Groups style={{ marginTop: "1.8rem" }} />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F08",
    desc: "brand centered TOP over a hairline · columns below · bee behind",
    render: () => (
      <Shell bee={<Bee w="58%" opacity={0.05} style={{ top: "60%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <div style={{ textAlign: "center" }}><Wordmark center /></div>
        <div style={{ borderTop: HAIR, margin: "1.6rem 0" }} />
        <Groups />
        <Copy center />
      </Shell>
    ),
  },
  {
    id: "F09",
    desc: "big Bebas wordmark dominant (brandTop) · slim column row",
    render: () => (
      <Shell bee={<Bee w="40%" opacity={0.06} style={{ top: "50%", right: "-6%", transform: "translateY(-50%)" }} />}>
        <span className="font-display" style={{ fontSize: "clamp(2rem, 6vw, 3.4rem)", letterSpacing: "0.06em", color: "var(--color-title)", lineHeight: 0.95, display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ width: "2.6rem", height: "2.6rem", color: "var(--color-command-gold)", flexShrink: 0 }}><BrandMark className="block h-full w-full" /></span>
          ONE THOUSAND DRONES
        </span>
        <div style={{ borderTop: HAIR, margin: "1.6rem 0" }} />
        <Groups />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F10",
    desc: "inline single-row links · bee bottom-left corner",
    render: () => (
      <Shell bee={<Bee w="34%" opacity={0.08} style={{ bottom: "-12%", left: "-5%" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1.5rem" }}>
          <Wordmark tag={false} />
          {inlineNav}
        </div>
        <div style={{ borderTop: HAIR, margin: "1.4rem 0 0" }} />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F11",
    desc: "GIANT bee (85%) barely-there · columns centered",
    render: () => (
      <Shell bee={<Bee w="85%" opacity={0.035} style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <Wordmark center />
          <Groups style={{ marginTop: "1.8rem", maxWidth: 720 }} />
        </div>
        <Copy center />
      </Shell>
    ),
  },
  {
    id: "F12",
    desc: "bee right-bleed · gold hairlines BETWEEN the link groups",
    render: () => (
      <Shell bee={<Bee w="44%" opacity={0.06} style={{ top: "50%", right: "-9%", transform: "translateY(-50%)" }} />}>
        <Wordmark />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", marginTop: "1.8rem" }}>
          {GROUPS.map((g, i) => (
            <div key={g.h} style={{ display: "flex", flexDirection: "column", padding: "0 1.2rem", borderLeft: i === 0 ? undefined : HAIR }}>
              <GroupHead>{g.h}</GroupHead>
              {g.links.map(([label, ext]) => <Link key={label} label={label} ext={ext} />)}
            </div>
          ))}
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F13",
    desc: "raised bg-2 band · bee centered · brand left",
    render: () => (
      <Shell raised bee={<Bee w="56%" opacity={0.05} style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 260 }}><Wordmark /></div>
          <Groups style={{ flex: 1, minWidth: 300 }} />
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F14",
    desc: "mono eyebrow ▸ COLOPHON + gold rule · bee behind",
    render: () => (
      <Shell bee={<Bee w="50%" opacity={0.05} style={{ top: "55%", right: "2%", transform: "translateY(-50%)" }} />}>
        <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)", marginBottom: "1rem" }}>▸ Colophon</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem", justifyContent: "space-between" }}>
          <div style={{ maxWidth: 260 }}><Wordmark /></div>
          <Groups style={{ flex: 1, minWidth: 300 }} />
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F15",
    desc: "defense-forward · registry featured · bee bottom-left",
    render: () => (
      <Shell bee={<Bee w="40%" opacity={0.07} style={{ bottom: "-16%", left: "-6%" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2.5rem", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ maxWidth: 300 }}>
            <Wordmark />
            <p className="font-mono" style={{ fontSize: 10.5, lineHeight: 1.85, letterSpacing: "0.04em", color: "var(--color-gray-3)", marginTop: "1.2rem" }}>
              {REGISTRY.map((r, i) => (<span key={i}>{r}<br /></span>))}
            </p>
          </div>
          <Groups withRegistry={false} style={{ flex: 1, minWidth: 280 }} />
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F16",
    desc: "tagline set LARGE over the watermark · links below",
    render: () => (
      <Shell bee={<Bee w="60%" opacity={0.05} style={{ top: "42%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <Wordmark tag={false} />
        <p className="font-display" style={{ fontSize: "clamp(1.4rem, 4vw, 2.2rem)", letterSpacing: "0.04em", color: "var(--color-command-gold)", margin: "1rem 0 1.8rem", lineHeight: 1 }}>ONE MIND, MANY MACHINES.</p>
        <Groups />
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F17",
    desc: "brand centered · columns in a tight 4-up row · giant bee",
    render: () => (
      <Shell bee={<Bee w="78%" opacity={0.04} style={{ top: "55%", left: "50%", transform: "translate(-50%,-50%)" }} />}>
        <div style={{ textAlign: "center", marginBottom: "1.8rem" }}><Wordmark center /></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "1.4rem", justifyItems: "center" }}>
          {GROUPS.map((g) => (
            <div key={g.h} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <GroupHead>{g.h}</GroupHead>
              {g.links.map(([label, ext]) => <Link key={label} label={label} ext={ext} />)}
            </div>
          ))}
        </div>
        <Copy center />
      </Shell>
    ),
  },
  {
    id: "F18",
    desc: "bee as a vertical sliver on the right · content fills left",
    render: () => (
      <Shell bee={<Bee w="64%" opacity={0.06} style={{ top: "50%", right: "-30%", transform: "translateY(-50%)" }} />}>
        <div style={{ maxWidth: "78%" }}>
          <Wordmark />
          <Groups style={{ marginTop: "1.8rem" }} />
        </div>
        <Copy />
      </Shell>
    ),
  },
  {
    id: "F19",
    desc: "compact · brand + inline links one line · bee top-bleed",
    render: () => (
      <Shell bee={<Bee w="48%" opacity={0.05} style={{ top: "-30%", left: "50%", transform: "translateX(-50%)" }} />}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1.2rem" }}>
          <Wordmark tag={false} wm="1.2rem" bee="1.4rem" />
          {inlineNav}
          <span className="font-mono" style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-gray-3)" }}>© 2026 OTD, LLC</span>
        </div>
      </Shell>
    ),
  },
  {
    id: "F20",
    desc: "two-band · wordmark band (bg-2) over a columns band · bee split",
    render: () => (
      <div>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--color-bg-2)", borderTop: "1px solid transparent", borderImage: "linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-command-gold) 55%, transparent), transparent) 1" }}>
          <Bee w="30%" opacity={0.09} style={{ top: "50%", right: "3%", transform: "translateY(-50%)" }} />
          <div style={{ position: "relative", maxWidth: "72rem", margin: "0 auto", padding: "2rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <Wordmark />
          </div>
        </div>
        <div style={{ position: "relative", overflow: "hidden", background: "var(--color-deep-space)" }}>
          <div style={{ position: "relative", maxWidth: "72rem", margin: "0 auto", padding: "2.2rem 1.5rem 2rem" }}>
            <Groups />
            <Copy />
          </div>
        </div>
      </div>
    ),
  },
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
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, borderBottom: "1px solid color-mix(in srgb, var(--color-command-gold) 40%, transparent)", paddingBottom: 16 }}>
        <div>
          <div className="font-mono" style={{ fontSize: 10, letterSpacing: "0.24em", textTransform: "uppercase", color: "var(--color-command-gold)" }}>▸ SANDBOX · FOOTER REDESIGN</div>
          <h1 className="font-display" style={{ fontSize: 44, letterSpacing: "0.02em", color: "var(--color-title)", lineHeight: 1, marginTop: 6 }}>Footer — 20 options</h1>
          <p className="font-serif" style={{ fontSize: 14, color: "var(--color-muted)", marginTop: 8, maxWidth: 680 }}>
            Every variant carries a large bee watermark (the field-guide idea). Flip the theme to judge BOTH; toggle Mobile to see each variant reflow at phone width. Pick a favourite (or a favourite + tweaks).
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
            <div style={{ width: mobile ? 390 : "100%", maxWidth: "100%", margin: mobile ? "0 auto" : undefined, border: HAIR, borderRadius: 14, overflow: "hidden" }}>
              {v.render()}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
