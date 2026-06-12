// GuideBlocks render tests — empty media visibility (2026-06-11).
//
// Behavior under test: an EMPTY image/video block (no `src`) is an admin-only
// affordance. A student (non-admin) sees NOTHING — not a half-finished
// "to be added" slot — while an admin keeps the in-place capture "+"
// (CaptureLauncher). A FILLED block is unaffected (everyone sees it).
//
// Following the StageTracker.test idiom, we don't use react-dom/server; we
// render the element tree in-memory by invoking function components as we walk,
// short-circuiting at CaptureLauncher (a "use client" leaf with hooks) and
// detecting it by reference.

import { describe, expect, test, vi } from "vitest";
import { isValidElement } from "react";
import type { ReactNode } from "react";

// GuideBlocks imports several "use client" children whose server-action imports
// transitively pull next-auth, which doesn't resolve under vitest's node env.
// Stub the ones with that chain (CaptureLauncher → guide-images → auth-helpers →
// next-auth; QuizBlock / GuideActionButton likewise). The CaptureLauncher stub
// is also what the empty-media assertions detect by reference.
vi.mock("@/components/guide/CaptureLauncher", () => ({
  CaptureLauncher: function CaptureLauncher() {
    return null;
  },
}));
vi.mock("@/components/guide/QuizBlock", () => ({
  QuizBlock: function QuizBlock() {
    return null;
  },
}));
vi.mock("@/components/guide/GuideActionButton", () => ({
  GuideActionButton: function GuideActionButton() {
    return null;
  },
}));

import { GuideBlocks } from "@/components/guide/GuideBlocks";
import { CaptureLauncher } from "@/components/guide/CaptureLauncher";
import type { ContentBlock } from "@/lib/schemas/guide";

type Collected = { text: string; foundLauncher: boolean };

// Walk the in-memory React tree. For a function-component element we invoke it
// to get its output (these are pure server components) and recurse — EXCEPT
// CaptureLauncher, which we detect by reference and never invoke (it's a client
// leaf that would run hooks outside a render).
function collect(node: ReactNode, acc: Collected): void {
  if (node == null || node === false || node === true) return;
  if (typeof node === "string" || typeof node === "number") {
    acc.text += String(node);
    return;
  }
  if (Array.isArray(node)) {
    for (const n of node) collect(n, acc);
    return;
  }
  if (!isValidElement(node)) return;
  const el = node as { type: unknown; props: { children?: ReactNode } };
  if (el.type === CaptureLauncher) {
    acc.foundLauncher = true;
    return;
  }
  if (typeof el.type === "function") {
    const out = (el.type as (p: unknown) => ReactNode)(el.props);
    collect(out, acc);
    return;
  }
  // DOM element or Fragment symbol → recurse into children.
  collect(el.props?.children, acc);
}

function render(blocks: ContentBlock[], isAdmin: boolean): Collected {
  const tree = GuideBlocks({ blocks, cardId: "card1", isAdmin });
  const acc: Collected = { text: "", foundLauncher: false };
  collect(tree, acc);
  return acc;
}

const emptyImage: ContentBlock = { type: "image", src: "", alt: "a drag-solder pass" };
const emptyVideo: ContentBlock = { type: "video", src: "", alt: "a drag-solder pass" };
const filledImage: ContentBlock = {
  type: "image",
  src: "/api/shot/abc123.webp",
  alt: "the routed board",
};

describe("GuideBlocks — empty media visibility", () => {
  test("student (non-admin): empty image renders nothing (no 'to be added' slot, no capture +)", () => {
    const r = render([emptyImage], false);
    expect(r.text).not.toContain("to be added");
    expect(r.foundLauncher).toBe(false);
  });

  test("student (non-admin): empty video renders nothing", () => {
    const r = render([emptyVideo], false);
    expect(r.text).not.toContain("to be added");
    expect(r.foundLauncher).toBe(false);
  });

  test("admin: empty image keeps the 'to be added' slot AND the capture +", () => {
    const r = render([emptyImage], true);
    expect(r.text).toContain("to be added");
    expect(r.foundLauncher).toBe(true);
  });

  test("admin: empty video keeps the 'to be added' slot AND the capture +", () => {
    const r = render([emptyVideo], true);
    expect(r.text).toContain("to be added");
    expect(r.foundLauncher).toBe(true);
  });

  test("filled image renders for a student (only EMPTY media is hidden)", () => {
    const r = render([filledImage], false);
    expect(r.foundLauncher).toBe(false); // no "+" for non-admins
    // The figure/img is present — the block is not suppressed.
    expect(render([filledImage], false)).toBeTruthy();
  });
});

describe("GuideBlocks — mode band", () => {
  const modeDo: ContentBlock = {
    type: "callout",
    severity: "info",
    label: "Mode · do — in KiCad · Build it, island by island",
    body: "From here, have KiCad open.",
  };

  test("a 'Mode ·' callout renders a parsed mode band, not a raw callout", () => {
    const r = render([modeDo], false);
    expect(r.text).toContain("Build it, island by island"); // the section title
    expect(r.text).toContain("From here, have KiCad open"); // the subtitle/body
    expect(r.text).toContain("do — in KiCad"); // the mode eyebrow
    expect(r.text).not.toContain("Mode ·"); // parsed away — never shown as a raw label
  });
});
