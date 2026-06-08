// Whether the root layout (src/app/layout.tsx) should render the app-shell
// chrome (header + footer). It reads the middleware-set `x-pathname` header to
// learn the route, since the layout itself has no access to the path.
//
//  • `/sign-in` always stays chrome-free, so it reads as a clean full-bleed boot
//    screen (and so the chrome never appears on the page that lets you in).
//  • Signed-in users get the chrome everywhere else.
//  • Anonymous visitors get it only on PUBLIC routes (the parts catalog, the
//    public /courses index, and PUBLIC-eligible guide pages) — the SEO funnel —
//    where a sign-up CTA replaces the user menu.
import { isPublicPath } from "@/lib/admin-routes";

export function shouldRenderChrome(input: {
  pathname: string;
  signedIn: boolean;
}): boolean {
  if (input.pathname === "/sign-in") return false;
  return input.signedIn || isPublicPath(input.pathname);
}
