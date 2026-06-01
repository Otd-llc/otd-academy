// RegressAtRiskBanner render-walk tests (Task 12.8).
//
// StageActions itself is a client component (useActionState, useFormStatus,
// useState) so we extract the inner advisory banner into a pure helper and
// test that directly with the same in-memory React-element walk pattern
// used by StageTracker.test.tsx / TransitionsLog.test.tsx — no DOM, no SSR.
//
// Covered cases (proposal §3.1 spec text):
//   - empty atRisk → returns null
//   - one entry → singular "dependent" (no plural-s)
//   - two entries → plural "dependents", comma-joined slugs in the text,
//     and the alert-red treatment classes per design §9.4.

import { describe, expect, test } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { RegressAtRiskBanner } from "@/components/RegressAtRiskBanner";

function textOf(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) {
    const el = node as ReactElement<{ children?: ReactNode }>;
    if (typeof el.type === "function") {
      const Comp = el.type as (props: Record<string, unknown>) => ReactNode;
      return textOf(Comp(el.props as Record<string, unknown>));
    }
    return textOf(el.props.children);
  }
  return "";
}

function classOf(node: ReactNode): string {
  if (!isValidElement(node)) return "";
  const props = node.props as { className?: string };
  return props.className ?? "";
}

describe("RegressAtRiskBanner", () => {
  test("returns null when atRisk is empty", () => {
    const tree = RegressAtRiskBanner({ atRisk: [] });
    expect(tree).toBeNull();
  });

  test("singular entry: 'dependent' without plural-s and slug in text", () => {
    const tree = RegressAtRiskBanner({
      atRisk: [{ slug: "power-rail", name: "Power Rail" }],
    });
    expect(tree).not.toBeNull();
    const text = textOf(tree);
    expect(text).toContain("1 downstream dependent ");
    expect(text).not.toContain("dependents");
    expect(text).toContain("power-rail");
    expect(text).toContain("Continue?");
  });

  test("multiple entries: plural 'dependents', comma-joined slugs, alert-red classes", () => {
    const tree = RegressAtRiskBanner({
      atRisk: [
        { slug: "alpha-board", name: "Alpha Board" },
        { slug: "beta-board", name: "Beta Board" },
      ],
    });
    expect(tree).not.toBeNull();

    const cls = classOf(tree);
    expect(cls).toContain("border-alert-red");
    expect(cls).toContain("text-alert-red");
    expect(cls).toContain("bg-navy-dark");
    expect(cls).toContain("font-mono");

    const text = textOf(tree);
    expect(text).toContain("2 downstream dependents ");
    expect(text).toContain("alpha-board, beta-board");
    expect(text).toContain("who will need to re-validate");
    expect(text).toContain("Continue?");
  });
});
