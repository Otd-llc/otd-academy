// Share-card sandbox — F-family watermark round (convergence on option F).
//
// Josh picked the F split-panel direction and asked to see F carrying a large
// brand-mark watermark in the Field Guide style (the drone-bee mark, gold, low
// opacity, behind the content — same treatment the Library PDF cover uses:
// BrandGlyph size ~230 at ~0.08). Ten variations spanning: watermark vs crisp
// lockup, in-panel vs full-bleed, gold vs ivory, edge-crop vs centered, and the
// honeycomb/roundel framings. Rendered at the short title (the variable under
// test is the mark, not wrap — base F already proved long-title wrap).

import type { ReactElement, ReactNode } from "react";
import {
  Wordmark,
  Eyebrow,
  CardTitle,
  HexBadge,
  BrandGlyph,
  DefaultFooter,
} from "@/lib/og/card";
import { OG } from "@/lib/og/tokens";
import { Field } from "./options";
import { TITLES, type TitleLen } from "./meta";

export type WatermarkId =
  | "FW1"
  | "FW2"
  | "FW3"
  | "FW4"
  | "FW5"
  | "FW6"
  | "FW7"
  | "FW8"
  | "FW9"
  | "FW10";

export const WATERMARK_OPTIONS: {
  id: WatermarkId;
  label: string;
  blurb: string;
}[] = [
  { id: "FW1", label: "Framed logo panel", blurb: "The mark replaces the hex inside the right panel, bright gold. A framed logo lockup." },
  { id: "FW2", label: "Edge-bleed watermark", blurb: "No panel. A giant mark bleeds off the right edge at ~10% gold, behind the title." },
  { id: "FW3", label: "Centered ghost", blurb: "No panel. A huge mark, very faint (~5%), centered behind everything." },
  { id: "FW4", label: "Corner watermark (PDF cover)", blurb: "The Library-PDF treatment: mark cropped in the bottom-right corner at ~12%." },
  { id: "FW5", label: "Right pillar", blurb: "A full-height mark on the right at ~14% stands in for the panel column." },
  { id: "FW6", label: "Hex-framed logo", blurb: "The mark centered inside a large gold hex outline (marries F with the honeycomb)." },
  { id: "FW7", label: "Ivory ghost", blurb: "A large faint mark in warm ivory instead of gold (~7%), behind the title." },
  { id: "FW8", label: "Crisp lockup / stamp", blurb: "Not a watermark: a small, solid mark as a top-right registration stamp; title full-width." },
  { id: "FW9", label: "Roundel badge", blurb: "The mark inside a gold hairline circle on the right, on a raised panel." },
  { id: "FW10", label: "Layered (watermark + hex)", blurb: "Faint mark behind the left title AND the base-F hex panel kept on the right." },
];

// Shared left title block for the split layouts.
function TitleBlock({
  title,
  len,
  maxWidth = 540,
}: {
  title: string;
  len: TitleLen;
  maxWidth?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
        paddingRight: 44,
      }}
    >
      <Eyebrow tri>Library</Eyebrow>
      <CardTitle size={len === "long" ? 56 : 74} maxWidth={maxWidth}>
        {title}
      </CardTitle>
    </div>
  );
}

// A right-side square panel (the base-F asset panel).
function AssetPanel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        width: 340,
        height: 340,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: OG.BG_2,
        border: `1px solid ${OG.PANEL_BORDER}`,
        borderRadius: 14,
      }}
    >
      {children}
    </div>
  );
}

const abs = (s: Record<string, number>) => ({ position: "absolute" as const, ...s });

// ── FW1 · Framed logo panel ───────────────────────────────────────────────────
function FW1(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={500} />
        <AssetPanel>
          <BrandGlyph width={230} opacity={0.95} fill={OG.GOLD_LIGHT} />
        </AssetPanel>
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW2 · Edge-bleed watermark ────────────────────────────────────────────────
function FW2(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <BrandGlyph width={760} opacity={0.1} style={abs({ right: -170, top: 40 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={760} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW3 · Centered ghost ──────────────────────────────────────────────────────
function FW3(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <BrandGlyph width={640} opacity={0.05} style={abs({ left: 280, top: 8 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={720} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW4 · Corner watermark (the PDF-cover treatment) ──────────────────────────
function FW4(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <BrandGlyph width={380} opacity={0.12} style={abs({ right: -20, bottom: -10 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={720} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW5 · Right pillar ────────────────────────────────────────────────────────
function FW5(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <BrandGlyph width={540} opacity={0.14} style={abs({ right: -10, top: 50 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={640} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW6 · Hex-framed logo ─────────────────────────────────────────────────────
// Large pointy-top hex outline on the right with the mark centered inside.
// Positioned by absolute coords relative to the card (Satori resolves absolute to
// the root); panel center ≈ (940, 300).
function FW6(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <svg
        width={380}
        height={380}
        viewBox="0 0 100 100"
        style={abs({ right: 66, top: 118 })}
      >
        <polygon
          points="50,3 93,26 93,74 50,97 7,74 7,26"
          fill="none"
          stroke={OG.COMMAND_GOLD}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>
      <BrandGlyph width={190} opacity={0.92} style={abs({ right: 162, top: 214 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={480} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW7 · Ivory ghost ─────────────────────────────────────────────────────────
function FW7(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <BrandGlyph
        width={620}
        opacity={0.07}
        fill={OG.TITLE}
        style={abs({ right: -60, top: 24 })}
      />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={720} />
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW8 · Crisp lockup / stamp ────────────────────────────────────────────────
function FW8(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Wordmark />
        <BrandGlyph width={96} opacity={1} fill={OG.COMMAND_GOLD} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flexGrow: 1,
          justifyContent: "center",
        }}
      >
        <Eyebrow tri>Library</Eyebrow>
        <CardTitle size={len === "long" ? 72 : 96} maxWidth={1000}>
          {title}
        </CardTitle>
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW9 · Roundel badge ───────────────────────────────────────────────────────
function FW9(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={500} />
        <div
          style={{
            display: "flex",
            width: 360,
            height: 360,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: OG.BG_2,
            border: `1px solid ${OG.PANEL_BORDER}`,
            borderRadius: 360,
          }}
        >
          <BrandGlyph width={210} opacity={0.95} fill={OG.GOLD_LIGHT} />
        </div>
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── FW10 · Layered (watermark behind title + base-F hex panel) ────────────────
function FW10(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <BrandGlyph width={460} opacity={0.06} style={abs({ left: 24, top: 150 })} />
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <TitleBlock title={title} len={len} maxWidth={500} />
        <AssetPanel>
          <HexBadge n="03" size={190} />
        </AssetPanel>
      </div>
      <DefaultFooter />
    </Field>
  );
}

const RENDERERS: Record<
  WatermarkId,
  (title: string, len: TitleLen) => ReactElement
> = { FW1, FW2, FW3, FW4, FW5, FW6, FW7, FW8, FW9, FW10 };

export function renderWatermark(id: string, len: string): ReactElement {
  const renderer = RENDERERS[id as WatermarkId] ?? FW1;
  const titleLen: TitleLen = len === "long" ? "long" : "short";
  return renderer(TITLES[titleLen], titleLen);
}
