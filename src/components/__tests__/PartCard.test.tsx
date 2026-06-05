// src/components/__tests__/PartCard.test.tsx
import { describe, test, expect } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { PartCard } from "@/components/parts/PartCard";

function textOf(n: ReactNode): string {
  if (n == null || n === false) return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children);
  return "";
}
function hrefs(n: ReactNode, out: string[] = []): string[] {
  if (Array.isArray(n)) { n.forEach((x) => hrefs(x, out)); return out; }
  if (!isValidElement(n)) return out;
  const el = n as ReactElement<{ href?: string; children?: ReactNode }>;
  if (typeof el.props.href === "string") out.push(el.props.href);
  if (el.props.children !== undefined) hrefs(el.props.children, out);
  return out;
}

const part = { id: "p1", mpn: "RT9080-33GJ5", manufacturer: "Richtek", description: "LDO", category: "LDO_REGULATOR" as const, lifecycle: "ACTIVE" as const, isCertifiedModule: false };

describe("PartCard", () => {
  test("shows mpn + manufacturer and links to the detail page", () => {
    const tree = PartCard({ part }) as ReactElement;
    const text = textOf(tree);
    expect(text).toContain("RT9080-33GJ5");
    expect(text).toContain("Richtek");
    expect(hrefs(tree)).toContain("/parts/p1");
  });
});
