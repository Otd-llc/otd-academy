// PartsPagination render tests (Phase A, Task 6).
//
// Element-tree-walk tests, mirroring the StageTracker convention: we don't
// render to DOM (node env, no jsdom). The component is a sync function we call
// directly and then walk the returned React element tree, collecting every
// `href` prop, to assert the Prev/Next link destinations.
//
// Behavior pinned here matches the ACTUAL `partsHref` helper (Task 2):
// `partsHref(current, { page: "N" })` always yields a URL containing `page=N`
// (the page key is present in the patch, so it is NOT dropped) — including
// `page=1` for the prev link from page 2.

import { describe, test, expect } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { PartsPagination } from "@/components/parts/PartsPagination";

function hrefs(tree: ReactElement): string[] {
  const out: string[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as ReactElement<{ href?: string; children?: ReactNode }>;
    if (typeof el.props.href === "string") out.push(el.props.href);
    if (el.props.children !== undefined) walk(el.props.children);
  };
  walk(tree);
  return out;
}

describe("PartsPagination", () => {
  test("page 1: no prev link, next link keeps q and sets page=2", () => {
    const tree = PartsPagination({
      page: 1,
      totalPages: 3,
      current: { q: "10k" },
    }) as ReactElement;
    const hs = hrefs(tree);
    expect(hs.some((h) => h.includes("page=2") && h.includes("q=10k"))).toBe(
      true,
    );
    expect(hs.some((h) => h.includes("page=0"))).toBe(false);
  });

  test("middle page: prev and next both present", () => {
    const tree = PartsPagination({
      page: 2,
      totalPages: 3,
      current: {},
    }) as ReactElement;
    const hs = hrefs(tree);
    // Prev from page 2 patches { page: "1" }; partsHref keeps the explicit page
    // key, so the prev href contains `page=1` (it does NOT collapse to /parts).
    expect(hs.some((h) => h.includes("page=1"))).toBe(true);
    expect(hs.some((h) => h.includes("page=3"))).toBe(true);
  });

  test("totalPages <= 1: renders nothing", () => {
    expect(PartsPagination({ page: 1, totalPages: 1, current: {} })).toBe(null);
  });
});
