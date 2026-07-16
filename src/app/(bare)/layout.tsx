import { Suspense } from "react";

// The chrome-free routes: /sign-in and /embed/[slug]. Parenthesised, so the group
// adds nothing to their URLs.
//
//  • /sign-in reads as a clean full-bleed boot screen, and the chrome never
//    appears on the page that lets you in.
//  • /embed/* renders bare inside other sites' iframes — just the calculator and
//    its attribution.
//
// Before the route groups both were held chrome-free by a runtime pathname check
// (shouldRenderChrome). Living outside (chrome) is the same rule expressed
// structurally, which is what lets the chrome routes prerender their header.
//
// This layout exists only to carry the dynamic boundary that the root layout used
// to provide for every route (/sign-in awaits searchParams). Keep it synchronous
// for the same reason as the (chrome) layout.
export default function BareLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
