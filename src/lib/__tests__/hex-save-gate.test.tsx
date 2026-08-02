// The anonymous branch of the save page must RENDER, not redirect.
//
// This pins a bug that shipped and was caught only in a browser. The page used
// to call redirect() for a signed-out visitor. On this route that redirect is
// delivered after a 200 shell and executed by the client router — a scripted
// navigation, which does not inherit the URL fragment. The build being saved
// lives in that fragment, so every anonymous save lost the build outright:
// /sign-in's location.hash measured 0 characters where the save page's own
// document had 956. A middleware 307 (/account) does inherit it; this hop is
// not one.
//
// The guard is therefore structural: assert the anonymous branch returns an
// element tree containing the client gate, and assert it does not throw
// NEXT_REDIRECT. Re-introducing redirect() here fails both.
//
// Element-tree walk, matching the PartsPagination/StageTracker convention —
// the suite runs in the node environment with no DOM.

import { describe, test, expect, vi, beforeEach } from "vitest";
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth: () => auth() }));

import SaveHexClusterPage from "@/app/(chrome)/account/hex-clusters/save/page";
import { SaveSignInGate } from "@/components/hex/SaveSignInGate";
import { SaveHexClusterForm } from "@/components/hex/SaveHexClusterForm";

/** Every component type in the returned tree, plus every `target`/`mode` prop. */
function scan(tree: ReactNode): {
  types: unknown[];
  props: Record<string, unknown>[];
} {
  const types: unknown[] = [];
  const props: Record<string, unknown>[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as ReactElement<{ children?: ReactNode }>;
    types.push(el.type);
    props.push(el.props as Record<string, unknown>);
    if (el.props.children !== undefined) walk(el.props.children);
  };
  walk(tree);
  return { types, props };
}

beforeEach(() => auth.mockReset());

describe("the save page's anonymous branch", () => {
  test("renders the client gate instead of redirecting", async () => {
    auth.mockResolvedValue(null);
    const tree = await SaveHexClusterPage({
      searchParams: Promise.resolve({ mode: "new" }),
    });
    const { types } = scan(tree);
    expect(types).toContain(SaveSignInGate);
    expect(types).not.toContain(SaveHexClusterForm);
  });

  test("does not throw NEXT_REDIRECT — a redirect here drops the fragment", async () => {
    auth.mockResolvedValue(null);
    await expect(
      SaveHexClusterPage({ searchParams: Promise.resolve({ mode: "new" }) }),
    ).resolves.toBeTruthy();
  });

  test("carries mode and share into the gate's sign-in target, encoded", async () => {
    auth.mockResolvedValue(null);
    const tree = await SaveHexClusterPage({
      searchParams: Promise.resolve({ mode: "rev", share: "abc123" }),
    });
    const { props } = scan(tree);
    const target = props.find((p) => typeof p.target === "string")
      ?.target as string;
    expect(target).toBe("/account/hex-clusters/save?mode=rev&share=abc123");
    // The gate builds the sign-in URL from this, and an UNENCODED '&share='
    // would split off the callbackUrl parameter and turn a revision save into
    // a modeless one.
    expect(encodeURIComponent(target)).toContain("%26share%3Dabc123");
  });

  test("hands a signed-in visitor the form, not the gate", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
    const tree = await SaveHexClusterPage({
      searchParams: Promise.resolve({ mode: "rev", share: "abc123" }),
    });
    const { types, props } = scan(tree);
    expect(types).toContain(SaveHexClusterForm);
    expect(types).not.toContain(SaveSignInGate);
    const form = props.find((p) => p.mode !== undefined);
    expect(form).toMatchObject({ mode: "rev", share: "abc123" });
  });

  test("an unknown mode falls back to a new drawing, never to 'rev'", async () => {
    auth.mockResolvedValue({ user: { id: "u1", email: "a@b.c" } });
    const tree = await SaveHexClusterPage({
      searchParams: Promise.resolve({ mode: "sideways" }),
    });
    const { props } = scan(tree);
    expect(props.find((p) => p.mode !== undefined)).toMatchObject({
      mode: "new",
    });
  });
});
