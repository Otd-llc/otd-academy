// Share-card sandbox — the six option layouts (Task 2).
//
// Each renderer returns a Satori JSX node (flexbox-only, hex tokens, no var()).
// They compose the Task 1 kit atoms (Wordmark / Eyebrow / CardTitle /
// SairaReadout / HexBadge) into distinct shells so Josh compares whole families,
// not one shell with tweaks. Restyled in place once he picks — the atoms stay put.

import type { ReactElement, ReactNode } from "react";
import {
  CardShell,
  Wordmark,
  Eyebrow,
  CardTitle,
  SairaReadout,
  HexBadge,
  DefaultFooter,
} from "@/lib/og/card";
import { OG } from "@/lib/og/tokens";
import { TITLES, type OptionId, type TitleLen } from "./meta";

const WASH = `radial-gradient(1200px 620px at 82% -12%, ${OG.NAVY_DARK} 0%, ${OG.DEEP_SPACE} 58%)`;

// The bare field every non-default option sits on. `wash` toggles the radial
// glow; `frame` toggles the hairline border (drawn absolute, last).
function Field({
  wash,
  frame,
  children,
}: {
  wash: boolean;
  frame: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: OG.DEEP_SPACE,
        // Omit the key entirely when off — Satori's background parser calls
        // .trim() on the value and throws on `undefined`.
        ...(wash ? { backgroundImage: WASH } : {}),
        padding: "64px 80px",
        fontFamily: "Space Mono",
        color: OG.TEXT,
      }}
    >
      {children}
      {frame ? (
        <div
          style={{
            position: "absolute",
            top: 22,
            left: 22,
            right: 22,
            bottom: 22,
            border: `1px solid ${OG.PANEL_BORDER}`,
            borderRadius: 18,
          }}
        />
      ) : null}
    </div>
  );
}

// Body area that vertically centers its children in the free space between the
// wordmark row and the footer.
function Center({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
}

// ── A · Framed masthead (the kit default) ─────────────────────────────────────
function OptionA(title: string, len: TitleLen): ReactElement {
  return (
    <CardShell>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Eyebrow tri>Build guide</Eyebrow>
        <CardTitle size={len === "long" ? 74 : 96}>{title}</CardTitle>
      </div>
    </CardShell>
  );
}

// ── B · Left rail + hex ───────────────────────────────────────────────────────
function OptionB(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "stretch" }}>
        {/* Registration rail */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: 150,
            paddingTop: 26,
          }}
        >
          <HexBadge n="03" size={120} />
          <div
            style={{
              display: "flex",
              width: 3,
              flexGrow: 1,
              backgroundColor: OG.COMMAND_GOLD,
              marginTop: 22,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flexGrow: 1,
            paddingLeft: 44,
          }}
        >
          <Eyebrow>// Breakout board</Eyebrow>
          <CardTitle size={len === "long" ? 70 : 92} maxWidth={780}>
            {title}
          </CardTitle>
        </div>
      </div>
      <DefaultFooter />
    </Field>
  );
}

// ── C · Corner registration mark ──────────────────────────────────────────────
function OptionC(title: string, len: TitleLen): ReactElement {
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
        <HexBadge n="01" size={96} />
      </div>
      <Center>
        <Eyebrow tri>Hardware</Eyebrow>
        <CardTitle size={len === "long" ? 72 : 94}>{title}</CardTitle>
      </Center>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "Space Mono",
          fontSize: 20,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        <div style={{ display: "flex", color: OG.MUTED }}>
          academy.onethousanddrones.com
        </div>
        <div style={{ display: "flex", color: OG.COMMAND_GOLD }}>Rev A</div>
      </div>
    </Field>
  );
}

// ── D · Saira readout hero ────────────────────────────────────────────────────
function OptionD(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame={false}>
      <Wordmark />
      <Center>
        <Eyebrow tri>Supply budget</Eyebrow>
        <SairaReadout value="2.42" unit="A" label="recommended supply" />
        <div style={{ display: "flex", marginTop: 26 }}>
          <CardTitle size={len === "long" ? 46 : 58}>{title}</CardTitle>
        </div>
      </Center>
      <DefaultFooter />
    </Field>
  );
}

// ── E · Blueprint (flat, no wash) ─────────────────────────────────────────────
function OptionE(title: string, len: TitleLen): ReactElement {
  const rule = (color: string) => (
    <div
      style={{ display: "flex", height: 2, width: "100%", backgroundColor: color }}
    />
  );
  return (
    <Field wash={false} frame={false}>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Wordmark />
        <div style={{ display: "flex", marginTop: 22 }}>{rule(OG.PANEL_BORDER)}</div>
      </div>
      <Center>
        <Eyebrow>// Course</Eyebrow>
        <CardTitle size={len === "long" ? 80 : 108}>{title}</CardTitle>
      </Center>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {rule(OG.COMMAND_GOLD)}
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontFamily: "Space Mono",
            fontSize: 20,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: OG.MUTED,
          }}
        >
          One thousand drones academy
        </div>
      </div>
    </Field>
  );
}

// ── F · Split panel ───────────────────────────────────────────────────────────
function OptionF(title: string, len: TitleLen): ReactElement {
  return (
    <Field wash frame>
      <Wordmark />
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            paddingRight: 44,
          }}
        >
          <Eyebrow tri>Library</Eyebrow>
          <CardTitle size={len === "long" ? 56 : 74} maxWidth={560}>
            {title}
          </CardTitle>
        </div>
        {/* Asset panel — a hex stands in for the diagram / part render. */}
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
          <HexBadge n="03" size={190} />
        </div>
      </div>
      <DefaultFooter />
    </Field>
  );
}

const RENDERERS: Record<OptionId, (title: string, len: TitleLen) => ReactElement> =
  {
    A: OptionA,
    B: OptionB,
    C: OptionC,
    D: OptionD,
    E: OptionE,
    F: OptionF,
  };

// Build the node for `<id>-<len>`. Unknown id falls back to A short so the route
// never throws on a bad param.
export function renderOption(id: string, len: string): ReactElement {
  const renderer = RENDERERS[id as OptionId] ?? OptionA;
  const titleLen: TitleLen = len === "long" ? "long" : "short";
  return renderer(TITLES[titleLen], titleLen);
}
