// Public-chrome gate behind the root layout (src/app/layout.tsx). The layout
// reads the middleware-set `x-pathname` header and renders the app-shell
// header/footer when `shouldRenderChrome` says so — signed-in users on any
// non-/sign-in route, plus anonymous visitors on PUBLIC routes (the SEO funnel).
// `/sign-in` always stays chrome-free so it reads as a clean boot screen.
import { describe, it, expect } from "vitest";
import { shouldRenderChrome } from "@/lib/chrome";

describe("shouldRenderChrome", () => {
  it("renders for signed-in users on any non-signin route", () => {
    expect(shouldRenderChrome({ pathname: "/learn", signedIn: true })).toBe(true);
  });
  it("renders for anonymous on public routes", () => {
    expect(shouldRenderChrome({ pathname: "/courses", signedIn: false })).toBe(true);
    expect(shouldRenderChrome({ pathname: "/parts", signedIn: false })).toBe(true);
    expect(shouldRenderChrome({ pathname: "/projects/w/v1/guide/REQUIREMENTS", signedIn: false })).toBe(true);
  });
  it("never renders on /sign-in", () => {
    expect(shouldRenderChrome({ pathname: "/sign-in", signedIn: false })).toBe(false);
  });
  it("does not render for anonymous on non-public routes", () => {
    expect(shouldRenderChrome({ pathname: "/learn", signedIn: false })).toBe(false);
  });
});
