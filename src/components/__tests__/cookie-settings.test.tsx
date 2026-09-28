// The consent controls on the academy: the "Cookie settings" reopen control
// (footer + sign-in, beside every Privacy link in the chrome), the preference
// dialog it opens, and the banner copy that replaced c15t's default.
//
// Element-tree walks, like the other component tests here (node env, no DOM).
// c15t is mocked: what is under test is that OUR code calls its reopen API and
// hands it our copy, not c15t itself.
import { isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setActiveUI } = vi.hoisted(() => ({ setActiveUI: vi.fn() }));

vi.mock("@c15t/nextjs", () => ({
  useConsentManager: () => ({ setActiveUI, consents: {} }),
  ConsentManagerProvider: function ConsentManagerProvider(p: { children: ReactNode }) {
    return p.children;
  },
  ConsentBanner: function ConsentBanner() {
    return null;
  },
  ConsentDialog: function ConsentDialog() {
    return null;
  },
}));
vi.mock("@c15t/nextjs/styles.css", () => ({}));
// The footer's only env-validated import; not what is under test.
vi.mock("@/lib/seo/jsonld", () => ({ SOCIAL_LINKS: ["x", "yt", "gh", "li"] }));
vi.mock("@/components/chrome/ConsentBridge", () => ({ ConsentBridge: () => null }));

import { CookieSettingsButton } from "@/components/chrome/CookieSettingsButton";
import { AppFooter } from "@/components/chrome/AppFooter";
import { ConsentProviders, CONSENT_COPY } from "@/components/chrome/ConsentProviders";
import { ConsentDialog, ConsentManagerProvider } from "@c15t/nextjs";

type AnyEl = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

/** Every element in the tree, depth first, in document order. */
function elements(tree: ReactNode): AnyEl[] {
  const out: AnyEl[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as AnyEl;
    out.push(el);
    walk(el.props.children);
  };
  walk(tree);
  return out;
}

beforeEach(() => setActiveUI.mockClear());

describe("Cookie settings control", () => {
  it("reopens the c15t preference dialog on click", () => {
    const el = CookieSettingsButton({}) as AnyEl;
    expect(el.type).toBe("button");
    expect(el.props.type).toBe("button");
    expect(el.props.children).toBe("Cookie settings");
    (el.props.onClick as () => void)();
    expect(setActiveUI).toHaveBeenCalledTimes(1);
    expect(setActiveUI).toHaveBeenCalledWith("dialog");
  });

  it("sits in the footer directly after the Privacy link", () => {
    const all = elements(AppFooter());
    const privacy = all.findIndex((e) => e.props.href === "/privacy");
    expect(privacy).toBeGreaterThan(-1);
    const control = all.findIndex((e) => e.type === CookieSettingsButton);
    expect(control, "footer has no Cookie settings control").toBeGreaterThan(-1);
    // The very next element (the Link's only child is its text).
    expect(control).toBe(privacy + 1);
    // Same face as its neighbours.
    expect(all[control]!.props.className).toContain(all[privacy]!.props.className as string);
  });

  it("sits beside the Privacy link on the sign-in screen", () => {
    // /sign-in is a (bare) route with no footer, so it carries its own.
    const src = readFileSync(join(process.cwd(), "src/app/(bare)/sign-in/page.tsx"), "utf8");
    const privacy = src.indexOf('href="/privacy"');
    const control = src.indexOf("<CookieSettingsButton");
    expect(privacy).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(privacy);
    expect(src.slice(privacy, control).split("\n").length).toBeLessThan(12);
  });
});

describe("consent provider wiring", () => {
  const tree = ConsentProviders({ children: null }) as AnyEl;
  const all = elements(tree);

  it("mounts the preference dialog the control opens", () => {
    expect(all.some((e) => e.type === ConsentDialog)).toBe(true);
  });

  it("replaces c15t's banner copy, pinned to English", () => {
    const provider = all.find((e) => e.type === ConsentManagerProvider);
    const i18n = (provider!.props.options as { i18n: Record<string, unknown> }).i18n;
    expect(i18n).toEqual({
      locale: "en",
      detectBrowserLanguage: false,
      messages: { en: { cookieBanner: CONSENT_COPY } },
    });
    expect(CONSENT_COPY.title).toBe("Cookies and analytics");
    // The finding: the default promised content personalisation we do not do.
    const text = `${CONSENT_COPY.title} ${CONSENT_COPY.description}`;
    expect(text).not.toMatch(/personali[sz]ed/i);
    expect(text).toMatch(/with your permission/i);
  });

  it("marks the consent strings OWNER-WORDING", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/chrome/ConsentProviders.tsx"),
      "utf8",
    );
    expect(src.match(/OWNER-WORDING/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});
