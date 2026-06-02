// Render-walk tests for the ChecklistItemLabelCell pure helper (m16 / Task 16.10).
//
// `ChecklistEditor` itself is a client component (useActionState,
// useFormStatus) so its `ItemRow` cannot be invoked in a test renderer
// without dragging the React-DOM client runtime in. To exercise the visual
// states of the new N/A toggle we extracted the label cell into a pure
// presentational helper that the host row composes. This test walks the
// helper's element tree the same way StageTracker / TransitionsLog tests do.
//
// Covered cases:
//   - default (checked=false, notApplicable=false): no strikethrough, no badge
//   - checked=true: strikethrough + muted, no badge
//   - notApplicable=true: strikethrough + muted + "N/A" badge with the
//     command-gold treatment

import { describe, expect, test } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { ChecklistItemLabelCell } from "@/components/ChecklistItemLabelCell";

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

function classListOf(node: ReactNode): string[] {
  const classes: string[] = [];
  function walk(n: ReactNode) {
    if (Array.isArray(n)) {
      for (const x of n) walk(x);
      return;
    }
    if (!isValidElement(n)) return;
    const el = n as ReactElement;
    const props = el.props as { className?: string; children?: ReactNode };
    if (props.className) classes.push(props.className);
    if (props.children !== undefined) walk(props.children);
  }
  walk(node);
  return classes;
}

describe("ChecklistItemLabelCell", () => {
  test("default state: label rendered, no strikethrough, no N/A badge", () => {
    const tree = ChecklistItemLabelCell({
      ordinal: 0,
      label: "Capture power budget",
      checked: false,
      notApplicable: false,
    });
    const text = textOf(tree);
    expect(text).toContain("#1");
    expect(text).toContain("Capture power budget");
    expect(text).not.toContain("N/A");
    const allClasses = classListOf(tree).join(" ");
    expect(allClasses).not.toContain("line-through");
    // Unstruck label is a readable serif body in gray-1 (not the prior heavy
    // mono `text-white text-lg font-semibold`).
    expect(allClasses).toContain("font-serif");
    expect(allClasses).toContain("text-gray-1");
    expect(allClasses).not.toContain("text-white");
    expect(allClasses).not.toContain("font-semibold");
  });

  test("checked=true: strikethrough + muted, no N/A badge", () => {
    const tree = ChecklistItemLabelCell({
      ordinal: 2,
      label: "Item done",
      checked: true,
      notApplicable: false,
    });
    const text = textOf(tree);
    expect(text).toContain("#3");
    expect(text).toContain("Item done");
    expect(text).not.toContain("N/A");
    const allClasses = classListOf(tree).join(" ");
    expect(allClasses).toContain("line-through");
    expect(allClasses).toContain("text-muted");
    // Struck label keeps the readable serif body (just muted + struck now).
    expect(allClasses).toContain("font-serif");
  });

  test("notApplicable=true: N/A badge + strikethrough + command-gold treatment", () => {
    const tree = ChecklistItemLabelCell({
      ordinal: 0,
      label: "Not relevant",
      checked: false,
      notApplicable: true,
    });
    const text = textOf(tree);
    expect(text).toContain("Not relevant");
    expect(text).toContain("N/A");

    const allClasses = classListOf(tree).join(" ");
    expect(allClasses).toContain("line-through");
    // N/A badge uses the command-gold pill treatment (matches the canonical
    // gold accent used elsewhere in the One Thousand Drones tokens).
    expect(allClasses).toContain("border-command-gold");
    expect(allClasses).toContain("text-command-gold");
  });
});
