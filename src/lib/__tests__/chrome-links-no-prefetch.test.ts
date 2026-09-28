// Every `next/link` in the site chrome (header, nav, account menu, footer) has
// prefetch turned off. Launch item 0.11.
//
// WHY. The chrome is on every page, so its links are in the viewport on every
// load, and each viewport prefetch is a request through `src/proxy.ts` -- a
// billed proxy invocation. /hex measured 50 of them on one load. Turning
// prefetch off in the chrome is the cost lever. Narrowing the proxy matcher is
// NOT: it is the deny-by-default auth gate and the only JWT refresh.
//
// A source scan, parsed with the TypeScript compiler rather than a regex, so an
// arrow function inside a prop (`onClick={() => ...}`) cannot end a tag early,
// and a `<Link>` added later without the prop fails here by name.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const CHROME_FILES = [
  "src/components/chrome/AppHeader.tsx",
  "src/components/chrome/HeaderMenu.tsx",
  "src/components/chrome/AppFooter.tsx",
  "src/components/MainNav.tsx",
  "src/components/UserMenu.tsx",
];

type LinkTag = { line: number; prefetch: string | null };

function linkTags(rel: string): LinkTag[] {
  const text = readFileSync(join(process.cwd(), rel), "utf8");
  const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: LinkTag[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      node.tagName.getText(sf) === "Link"
    ) {
      let prefetch: string | null = null;
      for (const attr of node.attributes.properties) {
        if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === "prefetch") {
          prefetch = attr.initializer ? attr.initializer.getText(sf) : "true";
        }
      }
      out.push({
        line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
        prefetch,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

describe("site chrome links do not prefetch", () => {
  for (const rel of CHROME_FILES) {
    it(`${rel}: every <Link> has prefetch={false}`, () => {
      const tags = linkTags(rel);
      // Not green by absence: each of these files renders at least one Link.
      expect(tags.length, `${rel} has no <Link> left to check`).toBeGreaterThan(0);
      const offenders = tags
        .filter((t) => t.prefetch !== "{false}")
        .map((t) => `${rel}:${t.line} prefetch=${t.prefetch ?? "(default)"}`);
      expect(offenders).toEqual([]);
    });
  }

  it("covers all the Links the chrome renders (12 today)", () => {
    const total = CHROME_FILES.reduce((n, rel) => n + linkTags(rel).length, 0);
    expect(total).toBe(12);
  });
});
